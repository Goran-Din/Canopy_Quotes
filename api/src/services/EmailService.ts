import { render } from '@react-email/render';
import { Pool } from 'pg';
import { resend, FROM_DISPLAY } from '../config/resend.js';
import { ProposalEmailTemplate } from '../emails/ProposalEmailTemplate.js';
import { StatusAlertEmailTemplate } from '../emails/StatusAlertEmailTemplate.js';
import { PdfService } from './PdfService.js';
import { ProposalRepository } from '../repositories/ProposalRepository.js';

const IS_LOCAL_DEV = process.env.NODE_ENV === 'development';
const RESEND_KEY = process.env.RESEND_API_KEY ?? '';
const IS_RESEND_CONFIGURED = RESEND_KEY.length > 10 && !RESEND_KEY.includes('placeholder');

// ── Custom error ──────────────────────────────────────────────────────────────
export class EmailDeliveryError extends Error {
  constructor(msg: string) { super(msg); this.name = 'EmailDeliveryError'; }
}

// ── Result types ──────────────────────────────────────────────────────────────
export interface SendProposalEmailResult {
  message_id: string;
  sent_at: string;
  recipient_email: string;
  cc: string[];
}

export class EmailService {
  constructor(
    private pdfService: PdfService,
    private proposalRepo: ProposalRepository,
    private db: Pool
  ) {}

  // ── PRIMARY: Send proposal PDF to client ──────────────────────────────────

  async sendProposalEmail(
    tenantId: string,
    quoteId: string,
    recipientEmail: string,
    overrideEmail?: string
  ): Promise<SendProposalEmailResult> {
    // 1. Load all data needed for the email
    const data = await this.loadProposalEmailData(tenantId, quoteId);

    // 2. Find the current proposal PDF
    const proposal = await this.proposalRepo.findCurrentProposal(tenantId, quoteId);
    if (!proposal) {
      throw new Error('No proposal PDF found for this quote. Generate a PDF first.');
    }

    // 3. Fetch PDF buffer from R2
    const pdfBuffer = await this.pdfService.getPdfBuffer(proposal.r2_key);

    // 4. Determine recipient (override takes priority, staging intercept applies)
    const intendedEmail = overrideEmail || recipientEmail;
    const to = this.resolveRecipient(intendedEmail);

    // 5. Build CC list (salesperson gets copy unless they ARE the recipient)
    const cc: string[] = [];
    if (
      data.ccSalesperson &&
      data.salespersonEmail &&
      data.salespersonEmail.toLowerCase() !== intendedEmail.toLowerCase()
    ) {
      cc.push(this.resolveRecipient(data.salespersonEmail));
    }

    // 6. Render HTML email template
    const html = await render(ProposalEmailTemplate({
      customerName: data.customerName,
      propertyAddress: data.propertyAddress,
      quoteNumber: data.quoteNumber,
      salespersonName: data.salespersonName,
      salespersonEmail: data.salespersonEmail,
      salespersonPhone: data.salespersonPhone,
      totalAmount: this.formatCurrency(data.totalAmount),
      billingType: this.formatBillingType(data.billingType),
      validUntil: this.formatDate(data.validUntil),
      serviceType: this.formatServiceType(data.serviceType),
      tenantLogoUrl: data.tenantLogoUrl,
      tenantPrimaryColor: data.tenantPrimaryColor,
    }));

    // 7. Send via Resend (or mock in dev when Resend is not configured)
    if (IS_LOCAL_DEV && !IS_RESEND_CONFIGURED) {
      console.log(`[EmailService] Dev mode — skipping Resend API call`);
      console.log(`[EmailService]   To: ${to}`);
      console.log(`[EmailService]   Subject: Service Proposal #${data.quoteNumber}`);
      console.log(`[EmailService]   PDF attached: Proposal-${data.quoteNumber}.pdf (${pdfBuffer.length} bytes)`);
      const sent_at = new Date().toISOString();
      return {
        message_id: `dev-mock-${Date.now()}`,
        sent_at,
        recipient_email: to,
        cc,
      };
    }

    let result;
    try {
      result = await resend.emails.send({
        from: FROM_DISPLAY,
        to: [to],
        replyTo: data.salespersonEmail,
        cc: cc.length > 0 ? cc : undefined,
        subject: `Service Proposal #${data.quoteNumber} — Sunset Services`,
        html,
        attachments: [
          {
            filename: `Proposal-${data.quoteNumber}.pdf`,
            content: pdfBuffer,
          },
        ],
      });
    } catch (err: any) {
      throw new EmailDeliveryError(`Resend API error: ${err.message}`);
    }

    if (result.error) {
      throw new EmailDeliveryError(`Resend rejected email: ${result.error.message}`);
    }

    const sent_at = new Date().toISOString();

    return {
      message_id: result.data!.id,
      sent_at,
      recipient_email: to,
      cc,
    };
  }

  // ── STATUS ALERT: Notify salesperson of approved / rejected ───────────────

  async sendQuoteStatusAlert(
    tenantId: string,
    quoteId: string,
    newStatus: 'approved' | 'rejected',
    changedBy: string
  ): Promise<void> {
    const data = await this.loadStatusAlertData(tenantId, quoteId, changedBy);

    const html = await render(StatusAlertEmailTemplate({
      salespersonName: data.salespersonName,
      quoteNumber: data.quoteNumber,
      customerName: data.customerName,
      newStatus,
      changedByName: data.changedByName,
      totalAmount: this.formatCurrency(data.totalAmount),
      dashboardUrl: `${process.env.FRONTEND_URL ?? 'https://quotes.sunsetapp.us'}/quotes/${quoteId}`,
      tenantPrimaryColor: data.tenantPrimaryColor,
    }));

    const statusEmoji = newStatus === 'approved' ? '✅' : '❌';
    const to = this.resolveRecipient(data.salespersonEmail);

    const cc: string[] = [];
    if (data.divManagerEmail) {
      cc.push(this.resolveRecipient(data.divManagerEmail));
    }

    try {
      await resend.emails.send({
        from: FROM_DISPLAY,
        to: [to],
        cc: cc.length > 0 ? cc : undefined,
        subject: `${statusEmoji} Quote ${data.quoteNumber} ${newStatus === 'approved' ? 'Approved' : 'Rejected'} — Canopy Quotes`,
        html,
      });
    } catch (err: any) {
      // Status alerts are fire-and-forget — log but don't crash
      console.error('[EmailService] Failed to send status alert:', err.message);
    }
  }

  // ── SYSTEM ALERT: Critical error notification to admin ────────────────────

  async sendSystemAlert(
    tenantId: string,
    errorType: 'CRM_SYNC_FAILED' | 'PDF_GENERATION_FAILED' | string,
    entityId: string,
    message: string,
    details?: string
  ): Promise<void> {
    const alertEmailResult = await this.db.query<{ settings: any }>(
      `SELECT settings FROM tenants WHERE id = $1`,
      [tenantId]
    );
    const alertEmail =
      alertEmailResult.rows[0]?.settings?.admin_alert_email ??
      process.env.N37_ALERT_EMAIL;

    if (!alertEmail) {
      console.warn('[EmailService] No admin alert email configured — system alert not sent', { tenantId, errorType });
      return;
    }

    const env = process.env.NODE_ENV ?? 'unknown';
    const time = new Date().toISOString();

    try {
      await resend.emails.send({
        from: FROM_DISPLAY,
        to: [alertEmail],
        subject: `🚨 ${errorType} — Canopy Quotes ${env} — ${time}`,
        text: [
          'CANOPY QUOTES SYSTEM ALERT',
          '==========================',
          `Time: ${time}`,
          `Env: ${env}`,
          `Tenant: ${tenantId}`,
          `Error type: ${errorType}`,
          `Entity ID: ${entityId}`,
          `Message: ${message}`,
          details ? `Details:\n${details}` : '',
        ].filter(Boolean).join('\n'),
      });
    } catch (err: any) {
      // Fire-and-forget — log only
      console.error('[EmailService] Failed to send system alert:', err.message);
    }
  }

  // ── Data loaders ──────────────────────────────────────────────────────────

  private async loadProposalEmailData(tenantId: string, quoteId: string) {
    const result = await this.db.query(
      `SELECT
         q.quote_number, q.service_type, q.billing_type, q.total_amount, q.valid_until,
         c.name AS customer_name, c.billing_email,
         p.address AS property_address,
         u.first_name AS sp_first_name, u.last_name AS sp_last_name,
         u.email AS sp_email,
         t.settings AS tenant_settings
       FROM quotes q
       JOIN customers c ON c.id = q.customer_id
       JOIN properties p ON p.id = q.property_id
       JOIN users u ON u.id = q.created_by
       JOIN tenants t ON t.id = q.tenant_id
       WHERE q.tenant_id = $1 AND q.id = $2`,
      [tenantId, quoteId]
    );

    if (!result.rows[0]) throw new Error(`Quote ${quoteId} not found`);
    const row = result.rows[0];
    const settings = row.tenant_settings ?? {};

    return {
      quoteNumber: row.quote_number as string,
      serviceType: row.service_type as string,
      billingType: row.billing_type as string,
      totalAmount: parseFloat(row.total_amount),
      validUntil: row.valid_until as string | null,
      customerName: row.customer_name as string,
      customerEmail: row.billing_email as string,
      propertyAddress: this.formatAddress(row.property_address),
      salespersonName: `${row.sp_first_name} ${row.sp_last_name}`,
      salespersonEmail: row.sp_email as string,
      salespersonPhone: null as string | null,
      tenantLogoUrl: settings.logo_url ?? null,
      tenantPrimaryColor: settings.primary_color ?? '#2E75B6',
      ccSalesperson: settings.cc_salesperson !== false, // default TRUE
    };
  }

  private async loadStatusAlertData(tenantId: string, quoteId: string, changedById: string) {
    const result = await this.db.query(
      `SELECT
         q.quote_number, q.total_amount,
         c.name AS customer_name,
         u.first_name AS sp_first_name, u.last_name AS sp_last_name, u.email AS sp_email,
         t.settings AS tenant_settings
       FROM quotes q
       JOIN customers c ON c.id = q.customer_id
       JOIN users u ON u.id = q.created_by
       JOIN tenants t ON t.id = q.tenant_id
       WHERE q.tenant_id = $1 AND q.id = $2`,
      [tenantId, quoteId]
    );

    if (!result.rows[0]) throw new Error(`Quote ${quoteId} not found`);
    const row = result.rows[0];
    const settings = row.tenant_settings ?? {};

    // Load who changed the status
    const changerResult = await this.db.query(
      `SELECT first_name, last_name FROM users WHERE id = $1`,
      [changedById]
    );
    const changer = changerResult.rows[0];

    return {
      quoteNumber: row.quote_number as string,
      totalAmount: parseFloat(row.total_amount),
      customerName: row.customer_name as string,
      salespersonName: `${row.sp_first_name} ${row.sp_last_name}`,
      salespersonEmail: row.sp_email as string,
      changedByName: changer ? `${changer.first_name} ${changer.last_name}` : 'System',
      divManagerEmail: null as string | null,
      tenantPrimaryColor: settings.primary_color ?? '#2E75B6',
    };
  }

  // ── Staging safety: intercept all non-production emails ──────────────────

  private resolveRecipient(intendedEmail: string): string {
    const env = process.env.NODE_ENV;
    const stagingInbox = process.env.STAGING_EMAIL_INTERCEPT;

    if (env !== 'production' && stagingInbox) {
      console.info(`[STAGING] Email to ${intendedEmail} intercepted → ${stagingInbox}`);
      return stagingInbox;
    }

    if (env !== 'production' && !stagingInbox) {
      console.warn(`[EmailService] Non-production env with no STAGING_EMAIL_INTERCEPT — email to ${intendedEmail} blocked`);
      // Return a safe no-op address that will fail gracefully
      return 'dev-blocked@canopy.internal';
    }

    return intendedEmail;
  }

  // ── Formatting helpers ────────────────────────────────────────────────────

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  private formatDate(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  private formatAddress(address: Record<string, string> | null): string {
    if (!address) return 'Address not on record';
    return [address.street, address.city, address.state, address.zip]
      .filter(Boolean)
      .join(', ');
  }

  private formatBillingType(billingType: string): string {
    const map: Record<string, string> = {
      per_visit: 'Per Visit', monthly: 'Monthly', seasonal_flat: 'Seasonal Flat Rate',
      per_push: 'Per Push', annual: 'Annual', project: 'Project (One-Time)',
    };
    return map[billingType] ?? billingType;
  }

  private formatServiceType(serviceType: string): string {
    const map: Record<string, string> = {
      landscaping: 'Landscaping Maintenance', snow: 'Snow Removal',
      hardscape: 'Hardscape', project: 'Project',
    };
    return map[serviceType] ?? serviceType;
  }
}
