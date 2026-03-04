// ── Auth / User ───────────────────────────────────────────────────────────────
export type UserRole =
  | 'n37_super_admin'
  | 'owner'
  | 'division_manager'
  | 'salesperson'
  | 'coordinator';

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  tenant_id: string;
  tenant_name: string;
}

export interface AuthTokens {
  access_token: string;
}

// ── Quote types ───────────────────────────────────────────────────────────────
export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'converted';

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

export interface QuoteLineItem {
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
  line_items: QuoteLineItem[];
  current_proposal_id: string | null;
}

export interface QuoteListResult {
  quotes: QuoteListItem[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

export interface QuoteStats {
  period: string;
  total_quotes_this_month: number;
  pending_count: number;
  approved_count: number;
  total_value_sent: number;
  expiring_soon_count: number;
}

// ── Customer / Property ───────────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  contact_name: string | null;
  billing_email: string | null;
  phone: string | null;
  billing_address: Address | null;
  created_at: string;
}

export interface Property {
  id: string;
  name: string;
  address: Address | null;
  notes: string | null;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

// ── Service Catalog ───────────────────────────────────────────────────────────
export interface ServiceCatalogItem {
  id: string;
  name: string;
  category: string;
  billing_unit: string;
  description_template: string | null;
  is_active: boolean;
}

export interface PriceCalculation {
  unit_price: number;
  line_total: number;
  min_price_applied: boolean;
  formula_type: string;
  pricing_rule_applied: boolean;
}

// ── API response wrappers ─────────────────────────────────────────────────────
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

// ── Filters (dashboard) ───────────────────────────────────────────────────────
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
