// ── Quote list item (returned in paginated list) ─────────────────────────────
export interface QuoteListItem {
  id: string;
  quote_number: string;
  status: QuoteStatus;
  service_type: string;
  billing_type: string;
  total_amount: number;
  customer_name: string;
  property_name: string;
  salesperson_name: string;
  salesperson_id: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  valid_until: string | null;
  is_old_draft: boolean;
}

// ── Full quote detail (single quote view) ─────────────────────────────────────
export interface QuoteDetail extends QuoteListItem {
  customer_id: string;
  customer_email: string;
  property_id: string;
  property_address: Record<string, string> | null;
  season_year: number | null;
  notes_internal: string | null;
  notes_client: string | null;
  discount_pct: number | null;
  discount_amount: number | null;
  subtotal: number;
  line_items: QuoteLineItemDetail[];
  current_proposal_id: string | null;
}

export interface QuoteLineItemDetail {
  id: string;
  service_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  frequency: string | null;
  sort_order: number;
}

// ── Stats panel ───────────────────────────────────────────────────────────────
export interface QuoteStats {
  period: string;
  total_quotes_this_month: number;
  pending_count: number;
  approved_count: number;
  total_value_sent: number;
  expiring_soon_count: number;
}

// ── Paginated list result ─────────────────────────────────────────────────────
export interface QuoteListResult {
  quotes: QuoteListItem[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

// ── Filter parameters (from query string) ─────────────────────────────────────
export interface QuoteFilters {
  status?: QuoteStatus;
  search?: string;
  service_type?: string;
  salesperson_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  sort?: 'created_at' | 'updated_at' | 'total_amount' | 'quote_number';
  order?: 'asc' | 'desc';
}

// ── Status type ───────────────────────────────────────────────────────────────
export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'converted';

export type UserRole =
  | 'n37_super_admin'
  | 'owner'
  | 'division_manager'
  | 'salesperson'
  | 'coordinator';
