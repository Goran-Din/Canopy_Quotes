import { Pool } from 'pg';
import { ProposalRecord, ProposalData } from '../types/pdf.types.js';

export class ProposalRepository {
  constructor(private db: Pool) {}

  /**
   * Assembles all data needed to render the PDF proposal.
   * Single query for quote/tenant/customer/property/salesperson,
   * plus a separate query for line items.
   */
  async assembleProposalData(tenantId: string, quoteId: string): Promise<ProposalData> {
    const result = await this.db.query(
      `SELECT
        -- Quote
        q.id AS quote_id,
        q.quote_number,
        q.service_type,
        q.billing_type,
        q.season_year,
        q.subtotal,
        q.discount_pct,
        q.discount_amount,
        q.total_amount,
        q.notes_client,
        q.valid_until,
        -- Tenant
        t.name AS tenant_name,
        t.settings AS tenant_settings,
        -- Customer
        c.name AS customer_name,
        c.contact_name,
        c.billing_email,
        -- Property
        p.name AS property_name,
        p.address AS property_address,
        -- Salesperson
        u.first_name AS sp_first_name,
        u.last_name AS sp_last_name,
        u.email AS sp_email
       FROM quotes q
       JOIN tenants t ON t.id = q.tenant_id
       JOIN customers c ON c.id = q.customer_id
       JOIN properties p ON p.id = q.property_id
       JOIN users u ON u.id = q.created_by
       WHERE q.tenant_id = $1 AND q.id = $2`,
      [tenantId, quoteId]
    );

    if (!result.rows[0]) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    const row = result.rows[0];

    const lineItemsResult = await this.db.query(
      `SELECT service_name, description, quantity, unit, unit_price, line_total,
              frequency, sort_order
       FROM quote_line_items
       WHERE tenant_id = $1 AND quote_id = $2
       ORDER BY sort_order ASC`,
      [tenantId, quoteId]
    );

    const settings = row.tenant_settings ?? {};

    return {
      tenant: {
        name: row.tenant_name,
        logo_url: settings.logo_url ?? null,
        primary_color: settings.primary_color ?? '#2E75B6',
        company_address: settings.company_address ?? null,
        company_phone: settings.company_phone ?? null,
        company_email: settings.from_email ?? null,
        proposal_terms: settings.proposal_terms ?? null,
      },
      quote: {
        id: row.quote_id,
        quote_number: row.quote_number,
        service_type: row.service_type,
        billing_type: this.formatBillingType(row.billing_type),
        season_year: row.season_year,
        subtotal: parseFloat(row.subtotal),
        discount_pct: row.discount_pct ? parseFloat(row.discount_pct) : null,
        discount_amount: row.discount_amount ? parseFloat(row.discount_amount) : null,
        total_amount: parseFloat(row.total_amount),
        notes_client: row.notes_client,
        valid_until: row.valid_until,
        issued_date: new Date().toISOString().split('T')[0],
      },
      customer: {
        name: row.customer_name,
        contact_name: row.contact_name,
        billing_email: row.billing_email,
      },
      property: {
        name: row.property_name,
        address: row.property_address ?? null,
      },
      lineItems: lineItemsResult.rows.map((li) => ({
        service_name: li.service_name,
        description: li.description,
        quantity: parseFloat(li.quantity),
        unit: li.unit,
        unit_price: parseFloat(li.unit_price),
        line_total: parseFloat(li.line_total),
        frequency: li.frequency,
        sort_order: li.sort_order,
        is_project_fixed: li.unit === 'project',
      })),
      salesperson: {
        first_name: row.sp_first_name,
        last_name: row.sp_last_name,
        email: row.sp_email,
      },
    };
  }

  async getNextVersion(quoteId: string): Promise<number> {
    const result = await this.db.query<{ max_version: number | null }>(
      `SELECT MAX(version) AS max_version FROM proposals WHERE quote_id = $1`,
      [quoteId]
    );
    return (result.rows[0].max_version ?? 0) + 1;
  }

  async saveProposal(
    tenantId: string,
    quoteId: string,
    version: number,
    r2Key: string,
    fileSizeBytes: number,
    generatedBy: string
  ): Promise<ProposalRecord> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Mark all existing proposals for this quote as NOT current
      await client.query(
        `UPDATE proposals SET is_current = FALSE WHERE quote_id = $1 AND tenant_id = $2`,
        [quoteId, tenantId]
      );

      // Insert new proposal record as current
      const result = await client.query<ProposalRecord>(
        `INSERT INTO proposals
           (tenant_id, quote_id, version, r2_key, file_size_bytes, generated_by, is_current)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING *`,
        [tenantId, quoteId, version, r2Key, fileSizeBytes, generatedBy]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findCurrentProposal(tenantId: string, quoteId: string): Promise<ProposalRecord | null> {
    const result = await this.db.query<ProposalRecord>(
      `SELECT * FROM proposals
       WHERE tenant_id = $1 AND quote_id = $2 AND is_current = TRUE
       LIMIT 1`,
      [tenantId, quoteId]
    );
    return result.rows[0] ?? null;
  }

  async findById(tenantId: string, proposalId: string): Promise<ProposalRecord | null> {
    const result = await this.db.query<ProposalRecord>(
      `SELECT * FROM proposals WHERE tenant_id = $1 AND id = $2`,
      [tenantId, proposalId]
    );
    return result.rows[0] ?? null;
  }

  private formatBillingType(billingType: string): string {
    const map: Record<string, string> = {
      per_visit: 'Per Visit',
      monthly: 'Monthly',
      seasonal_flat: 'Seasonal Flat Rate',
      per_push: 'Per Push',
      annual: 'Annual',
      project: 'Project (One-Time)',
    };
    return map[billingType] ?? billingType;
  }
}
