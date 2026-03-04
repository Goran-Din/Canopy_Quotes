import { Pool } from 'pg';
import {
  QuoteListItem,
  QuoteDetail,
  QuoteStats,
  QuoteFilters,
  QuoteListResult,
  UserRole,
} from '../types/dashboard.types.js';

const PAGE_SIZE = 20;

export class DashboardRepository {
  constructor(private db: Pool) {}

  // ── Quote list with role scoping, filters, pagination ────────────────────

  async listQuotes(
    tenantId: string,
    userId: string,
    role: UserRole,
    filters: QuoteFilters
  ): Promise<QuoteListResult> {
    const page = filters.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;
    const sort = filters.sort ?? 'updated_at';
    const order = filters.order ?? 'desc';

    const params: unknown[] = [tenantId];
    const conditions: string[] = ['q.tenant_id = $1'];

    // ── Role scoping ──────────────────────────────────────────────────────
    if (role === 'salesperson') {
      params.push(userId);
      conditions.push(`q.created_by = $${params.length}`);
    } else if (role === 'division_manager') {
      // Division manager sees quotes from salespersons in their division
      params.push(userId);
      conditions.push(`EXISTS (
        SELECT 1 FROM users sp
        JOIN users mgr ON mgr.division_id = sp.division_id
        WHERE sp.id = q.created_by AND mgr.id = $${params.length}
      )`);
    }
    // owner, coordinator, n37_super_admin see all tenant quotes

    // ── Status filter ─────────────────────────────────────────────────────
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`q.status = $${params.length}`);
    }

    // ── Search (ILIKE across quote_number, customer name, property address) ─
    if (filters.search && filters.search.length >= 2) {
      params.push(`%${filters.search}%`);
      conditions.push(`(
        q.quote_number ILIKE $${params.length}
        OR c.name ILIKE $${params.length}
        OR p.name ILIKE $${params.length}
      )`);
    }

    // ── Service type filter ───────────────────────────────────────────────
    if (filters.service_type) {
      params.push(filters.service_type);
      conditions.push(`q.service_type = $${params.length}`);
    }

    // ── Salesperson filter (owner / division_manager only) ────────────────
    if (filters.salesperson_id && ['owner', 'division_manager', 'n37_super_admin'].includes(role)) {
      params.push(filters.salesperson_id);
      conditions.push(`q.created_by = $${params.length}`);
    }

    // ── Date range ────────────────────────────────────────────────────────
    if (filters.date_from) {
      params.push(filters.date_from);
      conditions.push(`q.created_at >= $${params.length}::date`);
    }
    if (filters.date_to) {
      params.push(filters.date_to);
      conditions.push(`q.created_at <= $${params.length}::date + INTERVAL '1 day'`);
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM quotes q
       JOIN customers c ON c.id = q.customer_id
       JOIN properties p ON p.id = q.property_id
       WHERE ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].total);

    // Data query
    const validSorts: Record<string, string> = {
      created_at: 'q.created_at',
      updated_at: 'q.updated_at',
      total_amount: 'q.total_amount',
      quote_number: 'q.quote_number',
    };
    const sortCol = validSorts[sort] ?? 'q.updated_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    params.push(PAGE_SIZE, offset);
    const dataResult = await this.db.query<QuoteListItem>(
      `SELECT
         q.id, q.quote_number, q.status, q.service_type, q.billing_type,
         q.total_amount, q.created_at, q.updated_at, q.sent_at, q.valid_until,
         q.created_by AS salesperson_id,
         c.name AS customer_name,
         p.name AS property_name,
         u.first_name || ' ' || u.last_name AS salesperson_name,
         CASE
           WHEN q.status = 'draft' AND q.created_at < NOW() - INTERVAL '7 days'
           THEN TRUE ELSE FALSE
         END AS is_old_draft
       FROM quotes q
       JOIN customers c ON c.id = q.customer_id
       JOIN properties p ON p.id = q.property_id
       JOIN users u ON u.id = q.created_by
       WHERE ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      quotes: dataResult.rows,
      pagination: {
        page,
        page_size: PAGE_SIZE,
        total_count: totalCount,
        total_pages: Math.ceil(totalCount / PAGE_SIZE),
      },
    };
  }

  // ── Stats panel ───────────────────────────────────────────────────────────

  async getStats(
    tenantId: string,
    userId: string,
    role: UserRole,
    month?: string
  ): Promise<QuoteStats> {
    const monthDate = month ? `${month}-01` : 'NOW()';

    const params: unknown[] = [tenantId];
    let roleScope = '';

    if (role === 'salesperson') {
      params.push(userId);
      roleScope = `AND q.created_by = $${params.length}`;
    } else if (role === 'division_manager') {
      params.push(userId);
      roleScope = `AND EXISTS (
        SELECT 1 FROM users sp JOIN users mgr ON mgr.division_id = sp.division_id
        WHERE sp.id = q.created_by AND mgr.id = $${params.length}
      )`;
    }

    const result = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE DATE_TRUNC('month', q.created_at) = DATE_TRUNC('month', ${monthDate}::date))
           AS total_quotes_this_month,
         COUNT(*) FILTER (WHERE q.status = 'sent')
           AS pending_count,
         COUNT(*) FILTER (WHERE q.status IN ('approved', 'converted'))
           AS approved_count,
         COALESCE(SUM(q.total_amount) FILTER (
           WHERE q.status IN ('sent','approved','converted')
           AND DATE_TRUNC('month', q.created_at) = DATE_TRUNC('month', ${monthDate}::date)
         ), 0) AS total_value_sent,
         COUNT(*) FILTER (
           WHERE q.status = 'sent'
           AND q.valid_until <= CURRENT_DATE + INTERVAL '5 days'
           AND q.valid_until >= CURRENT_DATE
         ) AS expiring_soon_count
       FROM quotes q
       WHERE q.tenant_id = $1 ${roleScope}`,
      params
    );

    const row = result.rows[0];
    return {
      period: month ?? new Date().toISOString().slice(0, 7),
      total_quotes_this_month: parseInt(row.total_quotes_this_month),
      pending_count: parseInt(row.pending_count),
      approved_count: parseInt(row.approved_count),
      total_value_sent: parseFloat(row.total_value_sent),
      expiring_soon_count: parseInt(row.expiring_soon_count),
    };
  }

  // ── Full quote detail ─────────────────────────────────────────────────────

  async getQuoteDetail(
    tenantId: string,
    quoteId: string
  ): Promise<QuoteDetail | null> {
    const result = await this.db.query(
      `SELECT
         q.id, q.quote_number, q.status, q.service_type, q.billing_type,
         q.total_amount, q.subtotal, q.discount_pct, q.discount_amount,
         q.created_at, q.updated_at, q.sent_at, q.valid_until, q.season_year,
         q.notes_internal, q.notes_client, q.created_by AS salesperson_id,
         q.customer_id, q.property_id,
         c.name AS customer_name, c.billing_email AS customer_email,
         p.name AS property_name, p.address AS property_address,
         u.first_name || ' ' || u.last_name AS salesperson_name,
         CASE
           WHEN q.status = 'draft' AND q.created_at < NOW() - INTERVAL '7 days'
           THEN TRUE ELSE FALSE
         END AS is_old_draft,
         (SELECT id FROM proposals WHERE quote_id = q.id AND is_current = TRUE LIMIT 1)
           AS current_proposal_id
       FROM quotes q
       JOIN customers c ON c.id = q.customer_id
       JOIN properties p ON p.id = q.property_id
       JOIN users u ON u.id = q.created_by
       WHERE q.tenant_id = $1 AND q.id = $2`,
      [tenantId, quoteId]
    );

    if (!result.rows[0]) return null;
    const row = result.rows[0];

    const lineItemsResult = await this.db.query(
      `SELECT id, service_name, description, quantity, unit, unit_price,
              line_total, frequency, sort_order
       FROM quote_line_items
       WHERE tenant_id = $1 AND quote_id = $2
       ORDER BY sort_order ASC`,
      [tenantId, quoteId]
    );

    return {
      ...row,
      total_amount: parseFloat(row.total_amount),
      subtotal: parseFloat(row.subtotal),
      discount_pct: row.discount_pct ? parseFloat(row.discount_pct) : null,
      discount_amount: row.discount_amount ? parseFloat(row.discount_amount) : null,
      line_items: lineItemsResult.rows.map((li) => ({
        id: li.id,
        service_name: li.service_name,
        description: li.description,
        quantity: parseFloat(li.quantity),
        unit: li.unit,
        unit_price: parseFloat(li.unit_price),
        line_total: parseFloat(li.line_total),
        frequency: li.frequency,
        sort_order: li.sort_order,
      })),
    };
  }

  // ── Status change ─────────────────────────────────────────────────────────

  async updateStatus(
    tenantId: string,
    quoteId: string,
    newStatus: 'approved' | 'rejected',
    _changedBy: string
  ): Promise<void> {
    const extraFields =
      newStatus === 'approved' ? ', approved_at = NOW()' : '';
    await this.db.query(
      `UPDATE quotes
       SET status = $3, updated_at = NOW() ${extraFields}
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, quoteId, newStatus]
    );
  }

  async findById(tenantId: string, quoteId: string) {
    const result = await this.db.query(
      `SELECT * FROM quotes WHERE tenant_id = $1 AND id = $2`,
      [tenantId, quoteId]
    );
    return result.rows[0] ?? null;
  }

  // ── Duplicate quote ───────────────────────────────────────────────────────

  async duplicateQuote(
    tenantId: string,
    sourceQuoteId: string,
    requestedBy: string,
    newQuoteNumber: string
  ): Promise<{ id: string; quote_number: string }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Copy quote header
      const newQuoteResult = await client.query(
        `INSERT INTO quotes
           (tenant_id, quote_number, customer_id, property_id, service_type,
            billing_type, season_year, notes_internal, notes_client,
            discount_pct, valid_until, created_by, status, subtotal,
            discount_amount, total_amount)
         SELECT
           tenant_id, $3, customer_id, property_id, service_type,
           billing_type, season_year, notes_internal, notes_client,
           discount_pct, valid_until, $4, 'draft', subtotal,
           discount_amount, total_amount
         FROM quotes WHERE tenant_id = $1 AND id = $2
         RETURNING id, quote_number`,
        [tenantId, sourceQuoteId, newQuoteNumber, requestedBy]
      );

      const newQuote = newQuoteResult.rows[0];

      // Copy all line items
      await client.query(
        `INSERT INTO quote_line_items
           (tenant_id, quote_id, service_catalog_id, service_name, description,
            quantity, unit, unit_price, line_total, frequency, sort_order)
         SELECT
           tenant_id, $3, service_catalog_id, service_name, description,
           quantity, unit, unit_price, line_total, frequency, sort_order
         FROM quote_line_items
         WHERE tenant_id = $1 AND quote_id = $2`,
        [tenantId, sourceQuoteId, newQuote.id]
      );

      await client.query('COMMIT');
      return newQuote;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Delete draft ──────────────────────────────────────────────────────────

  async deleteDraft(tenantId: string, quoteId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM quotes WHERE tenant_id = $1 AND id = $2`,
      [tenantId, quoteId]
    );
  }

  // ── Next quote number ─────────────────────────────────────────────────────

  async getNextQuoteNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.db.query<{ max_seq: number | null }>(
      `SELECT MAX(CAST(SPLIT_PART(quote_number, '-', 3) AS INTEGER)) AS max_seq
       FROM quotes
       WHERE tenant_id = $1 AND quote_number LIKE $2`,
      [tenantId, `SS-${year}-%`]
    );
    const nextSeq = (result.rows[0].max_seq ?? 0) + 1;
    return `SS-${year}-${String(nextSeq).padStart(4, '0')}`;
  }
}
