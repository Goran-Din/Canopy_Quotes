import puppeteerCore from 'puppeteer-core';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { ProposalRepository } from '../repositories/ProposalRepository.js';
import { ProposalRecord, ProposalData } from '../types/pdf.types.js';
import { R2_BUCKET } from '../config/r2Client.js';

const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB warning threshold
const PUPPETEER_TIMEOUT_MS = 30_000;
const IS_LOCAL_DEV = process.env.NODE_ENV === 'development';

// Local storage directory (relative to api/)
const LOCAL_STORAGE_DIR = path.resolve('storage', 'proposals');

export class PdfService {
  constructor(
    private proposalRepo: ProposalRepository,
    private r2Client: S3Client,
    _db: Pool
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Primary entry point. Called from the Bull worker, NOT from HTTP handlers.
   * Assembles data → generates HTML → renders PDF → uploads to R2 → saves DB record.
   */
  async generateProposal(
    tenantId: string,
    quoteId: string,
    generatedBy: string
  ): Promise<ProposalRecord> {
    // 1. Assemble quote data
    const data = await this.proposalRepo.assembleProposalData(tenantId, quoteId);

    // 2. Get next version number
    const version = await this.proposalRepo.getNextVersion(quoteId);

    // 3. Generate HTML → PDF
    const html = this.generateHtml(data);
    const buffer = await this.renderPdf(html);

    // 4. Warn if over size limit
    if (buffer.length > MAX_PDF_BYTES) {
      console.warn(
        `[PdfService] PDF size ${buffer.length} bytes exceeds 5MB target for quote ${quoteId}`
      );
    }

    // 5. Upload to R2
    const r2Key = this.buildR2Key(tenantId, quoteId, version);
    await this.uploadToR2(buffer, r2Key);

    // 6. Save proposal record in DB (transaction: mark old as not current, insert new)
    return this.proposalRepo.saveProposal(
      tenantId,
      quoteId,
      version,
      r2Key,
      buffer.length,
      generatedBy
    );
  }

  /**
   * Returns a fresh signed URL for an existing proposal.
   * URL expires in 1 hour. Never store signed URLs — always call this.
   */
  async getSignedUrl(tenantId: string, proposalId: string): Promise<string> {
    const proposal = await this.proposalRepo.findById(tenantId, proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    return this.generateSignedUrl(proposal.r2_key);
  }

  /**
   * Get fresh signed URL for the current proposal of a quote.
   */
  async getCurrentProposalUrl(
    tenantId: string,
    quoteId: string
  ): Promise<{ proposal: ProposalRecord; signed_url: string; expires_at: string }> {
    const proposal = await this.proposalRepo.findCurrentProposal(tenantId, quoteId);
    if (!proposal) throw new Error('No proposal generated for this quote yet');

    const signed_url = await this.generateSignedUrl(proposal.r2_key);
    const expires_at = new Date(Date.now() + 3600 * 1000).toISOString();

    return { proposal, signed_url, expires_at };
  }

  /**
   * Retrieves the binary PDF buffer from R2 for attaching to emails.
   */
  async getPdfBuffer(r2Key: string): Promise<Buffer> {
    if (IS_LOCAL_DEV) {
      const filePath = path.join(LOCAL_STORAGE_DIR, r2Key);
      return fs.readFile(filePath);
    }
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key });
    const response = await this.r2Client.send(command);
    const stream = response.Body as NodeJS.ReadableStream;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildR2Key(tenantId: string, quoteId: string, version: number): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${tenantId}/proposals/${quoteId}/${timestamp}_proposal-v${version}.pdf`;
  }

  private async uploadToR2(buffer: Buffer, r2Key: string): Promise<void> {
    if (IS_LOCAL_DEV) {
      return this.saveLocalFile(buffer, r2Key);
    }
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: buffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
    });
    await this.r2Client.send(command);
  }

  private async generateSignedUrl(r2Key: string): Promise<string> {
    if (IS_LOCAL_DEV) {
      return this.localFileUrl(r2Key);
    }
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key });
    return awsGetSignedUrl(this.r2Client, command, { expiresIn: 3600 }); // 1 hour
  }

  // ── Local dev file storage ──────────────────────────────────────────────────

  private async saveLocalFile(buffer: Buffer, r2Key: string): Promise<void> {
    const filePath = path.join(LOCAL_STORAGE_DIR, r2Key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    console.log(`[PdfService] Local PDF saved: ${filePath}`);
  }

  private localFileUrl(r2Key: string): string {
    const port = process.env.PORT ?? '3000';
    return `http://localhost:${port}/storage/proposals/${r2Key}`;
  }

  private async renderPdf(html: string): Promise<Buffer> {
    let browser;
    try {
      if (IS_LOCAL_DEV) {
        // Use full puppeteer (auto-bundled Chromium) for local development
        const puppeteer = await import('puppeteer');
        browser = await puppeteer.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
      } else {
        // Use puppeteer-core + @sparticuz/chromium for production/serverless
        const chromium = await import('@sparticuz/chromium');
        browser = await puppeteerCore.launch({
          args: chromium.default.args,
          defaultViewport: { width: 1920, height: 1080 },
          executablePath: await chromium.default.executablePath(),
          headless: true,
        });
      }

      const page = await browser.newPage();

      // Set timeout for render
      page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT_MS);

      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // ── HTML Template ─────────────────────────────────────────────────────────

  generateHtml(data: ProposalData): string {
    const color = data.tenant.primary_color;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposal ${data.quote.quote_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #222; line-height: 1.5; }

    /* === HEADER === */
    .header { display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 16px; border-bottom: 3px solid ${color}; margin-bottom: 20px; }
    .company-name { font-size: 18pt; font-weight: bold; color: ${color}; }
    .company-details { font-size: 9pt; color: #555; margin-top: 4px; }
    .proposal-meta { text-align: right; }
    .proposal-number { font-size: 14pt; font-weight: bold; color: ${color}; }
    .proposal-dates { font-size: 9pt; color: #555; margin-top: 4px; }

    /* === CLIENT BLOCK === */
    .client-block { background: #f8f8f8; border-left: 4px solid ${color};
      padding: 12px 16px; margin-bottom: 20px; }
    .client-block h3 { font-size: 10pt; color: ${color}; text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 8px; }
    .client-name { font-size: 12pt; font-weight: bold; }
    .client-details { font-size: 10pt; color: #444; margin-top: 4px; }

    /* === SECTION HEADING === */
    .section-heading { font-size: 12pt; font-weight: bold; color: ${color};
      border-bottom: 2px solid ${color}; padding-bottom: 6px;
      margin-bottom: 12px; margin-top: 24px; }

    /* === SERVICES TABLE === */
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th { background: ${color}; color: white; padding: 8px 10px;
      text-align: left; font-size: 9pt; font-weight: bold; }
    tr:nth-child(even) { background: #f5f5f5; }
    td { padding: 7px 10px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
    td.amount { text-align: right; white-space: nowrap; }
    th.amount { text-align: right; }
    .service-desc { font-size: 9pt; color: #555; margin-top: 3px; }

    /* === PRICING SUMMARY === */
    .summary-block { margin-top: 16px; float: right; min-width: 280px; }
    .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 11pt; }
    .summary-row.discount { color: #d32f2f; }
    .summary-row.total { font-weight: bold; font-size: 14pt;
      border-top: 2px solid ${color}; padding-top: 10px; margin-top: 4px; color: ${color}; }
    .billing-note { clear: both; font-size: 9pt; color: #666; margin-top: 8px; }
    .client-notes { margin-top: 16px; font-size: 10pt; color: #333;
      background: #fffbec; border-left: 3px solid #f5c842; padding: 10px 14px; }

    /* === TERMS === */
    .terms-block { margin-top: 32px; font-size: 9pt; color: #444;
      border-top: 1px solid #ccc; padding-top: 16px; }
    .terms-block h3 { font-size: 11pt; color: ${color}; margin-bottom: 8px; }
    .terms-text { line-height: 1.6; white-space: pre-wrap; }

    /* === ACCEPTANCE === */
    .acceptance-block { margin-top: 32px; padding: 20px;
      border: 1px solid #ccc; page-break-inside: avoid; }
    .acceptance-block h3 { font-size: 11pt; color: ${color}; margin-bottom: 12px; }
    .acceptance-intro { font-size: 10pt; margin-bottom: 20px; }
    .sig-line { display: flex; gap: 48px; margin-top: 24px; }
    .sig-field { flex: 1; border-bottom: 1px solid #333; padding-bottom: 4px; min-height: 40px; }
    .sig-label { font-size: 8pt; color: #888; margin-top: 4px; }
    .digital-note { margin-top: 12px; font-size: 8pt; color: #aaa; font-style: italic; }

    /* === FOOTER (every page) === */
    @page { size: A4 portrait; margin: 20mm; }
    footer { position: fixed; bottom: 0; left: 0; right: 0;
      border-top: 2px solid ${color}; padding: 6px 0;
      font-size: 8pt; color: #777; display: flex; justify-content: space-between; }
    .page-num::after { content: "Page " counter(page) " of " counter(pages); }
  </style>
</head>
<body>

  ${this.renderHeader(data)}
  ${this.renderClientDetails(data)}
  ${this.renderServicesTable(data)}
  ${this.renderPricingSummary(data)}
  ${this.renderTerms(data)}
  ${this.renderAcceptanceBlock()}

  <footer>
    <span>${data.tenant.name} | ${data.tenant.company_email ?? ''} | ${data.tenant.company_phone ?? ''}</span>
    <span>Proposal ${data.quote.quote_number} | <span class="page-num"></span></span>
  </footer>

</body>
</html>`;
  }

  private renderHeader(data: ProposalData): string {
    const logo = data.tenant.logo_url
      ? `<img src="${data.tenant.logo_url}" alt="${data.tenant.name}" style="max-height:60px; max-width:200px;">`
      : `<div class="company-name">${this.esc(data.tenant.name)}</div>`;

    return `
    <div class="header">
      <div>
        ${logo}
        <div class="company-details">
          ${data.tenant.company_address ? `${this.esc(data.tenant.company_address)}<br>` : ''}
          ${data.tenant.company_phone ? `${this.esc(data.tenant.company_phone)}` : ''}
          ${data.tenant.company_email ? ` | ${this.esc(data.tenant.company_email)}` : ''}
        </div>
      </div>
      <div class="proposal-meta">
        <div class="proposal-number">PROPOSAL</div>
        <div class="proposal-number" style="font-size:12pt;">${this.esc(data.quote.quote_number)}</div>
        <div class="proposal-dates">
          Issued: ${this.formatDate(data.quote.issued_date)}<br>
          ${data.quote.valid_until ? `Valid Until: ${this.formatDate(data.quote.valid_until)}` : ''}
          ${data.quote.season_year ? `<br>Season: ${data.quote.season_year}` : ''}
        </div>
      </div>
    </div>`;
  }

  private renderClientDetails(data: ProposalData): string {
    const addr = data.property.address;
    const addrStr = addr
      ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
      : '';

    return `
    <div class="client-block">
      <h3>Prepared For</h3>
      <div class="client-name">${this.esc(data.customer.name)}</div>
      <div class="client-details">
        ${data.customer.contact_name ? `Attention: ${this.esc(data.customer.contact_name)}<br>` : ''}
        ${this.esc(data.customer.billing_email)}<br>
        <strong>Property:</strong> ${this.esc(data.property.name)}
        ${addrStr ? `<br>${this.esc(addrStr)}` : ''}
      </div>
    </div>`;
  }

  private renderServicesTable(data: ProposalData): string {
    const rows = data.lineItems.map((item) => `
      <tr>
        <td>
          <strong>${this.esc(item.service_name)}</strong>
          ${item.description ? `<div class="service-desc">${this.esc(item.description)}</div>` : ''}
          ${item.frequency ? `<div class="service-desc">Frequency: ${this.esc(item.frequency)}</div>` : ''}
        </td>
        <td>${item.is_project_fixed ? 'Project' : item.quantity.toLocaleString()}</td>
        <td>${item.is_project_fixed ? '—' : this.esc(item.unit)}</td>
        <td class="amount">${item.is_project_fixed ? '—' : this.formatCurrency(item.unit_price)}</td>
        <td class="amount">${this.formatCurrency(item.line_total)}</td>
      </tr>`).join('');

    return `
    <div class="section-heading">Proposed Services</div>
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Qty</th>
          <th>Unit</th>
          <th class="amount">Unit Price</th>
          <th class="amount">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  private renderPricingSummary(data: ProposalData): string {
    const q = data.quote;
    const discountRow = q.discount_amount && q.discount_amount > 0
      ? `<div class="summary-row discount">
           <span>Discount ${q.discount_pct ? `(${q.discount_pct}%)` : ''}</span>
           <span>-${this.formatCurrency(q.discount_amount)}</span>
         </div>`
      : '';

    const clientNotes = q.notes_client
      ? `<div class="client-notes"><strong>Note:</strong> ${this.esc(q.notes_client)}</div>`
      : '';

    return `
    <div class="summary-block">
      <div class="summary-row">
        <span>Subtotal</span>
        <span>${this.formatCurrency(q.subtotal)}</span>
      </div>
      ${discountRow}
      <div class="summary-row total">
        <span>Total</span>
        <span>${this.formatCurrency(q.total_amount)}</span>
      </div>
    </div>
    <div class="billing-note">Billing: ${this.esc(q.billing_type)}</div>
    ${clientNotes}`;
  }

  private renderTerms(data: ProposalData): string {
    const terms = data.tenant.proposal_terms ?? this.getDefaultTerms();
    return `
    <div class="terms-block">
      <h3>Terms &amp; Conditions</h3>
      <div class="terms-text">${this.esc(terms)}</div>
    </div>`;
  }

  private renderAcceptanceBlock(): string {
    return `
    <div class="acceptance-block">
      <h3>Acceptance of Proposal</h3>
      <div class="acceptance-intro">
        By signing below, the client confirms acceptance of the proposed services and pricing
        detailed in this proposal.
      </div>
      <div class="sig-line">
        <div>
          <div class="sig-field"></div>
          <div class="sig-label">Authorized Signature</div>
        </div>
        <div>
          <div class="sig-field"></div>
          <div class="sig-label">Date</div>
        </div>
      </div>
      <div style="margin-top: 20px;">
        <div class="sig-field" style="max-width: 300px;"></div>
        <div class="sig-label">Printed Name</div>
      </div>
      <div class="digital-note">
        Digital acceptance available — contact your representative.
      </div>
    </div>`;
  }

  private getDefaultTerms(): string {
    return `Payment Terms: Payment is due within 30 days of invoice date. A 1.5% monthly late fee applies to overdue balances.

Cancellation Policy: Either party may cancel this agreement with 30 days written notice. Services rendered prior to cancellation are billable at the agreed rate.

Service Standards: Sunset Services will perform all services in a professional manner consistent with industry standards. Service times may vary due to weather, equipment availability, or site conditions.

Weather / Force Majeure: Services may be delayed or rescheduled due to inclement weather, acts of nature, or circumstances beyond our control. We will make every effort to complete services within a reasonable timeframe.

Pricing: Prices are valid for the duration stated in this proposal. Price adjustments may apply to contract renewals.`;
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  private esc(str: string | null | undefined): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  private formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }
}
