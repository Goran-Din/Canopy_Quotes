// ── Proposal record (mirrors proposals DB table) ─────────────────────────────
export interface ProposalRecord {
  id: string;
  tenant_id: string;
  quote_id: string;
  version: number;
  r2_key: string;
  file_size_bytes: number;
  generated_by: string;
  is_current: boolean;
  created_at: string;
}

// ── Data assembled for HTML template ─────────────────────────────────────────
export interface ProposalData {
  tenant: {
    name: string;
    logo_url: string | null;
    primary_color: string;
    company_address: string | null;
    company_phone: string | null;
    company_email: string | null;
    proposal_terms: string | null;
  };
  quote: {
    id: string;
    quote_number: string;
    service_type: string;
    billing_type: string;
    season_year: number | null;
    subtotal: number;
    discount_pct: number | null;
    discount_amount: number | null;
    total_amount: number;
    notes_client: string | null;
    valid_until: string | null;
    issued_date: string;
  };
  customer: {
    name: string;
    contact_name: string | null;
    billing_email: string;
  };
  property: {
    name: string;
    address: Record<string, string> | null;
  };
  lineItems: ProposalLineItem[];
  salesperson: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface ProposalLineItem {
  service_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  frequency: string | null;
  sort_order: number;
  is_project_fixed: boolean;
}

// ── Bull job payload ──────────────────────────────────────────────────────────
export interface PdfJobData {
  tenantId: string;
  quoteId: string;
  generatedBy: string;
  jobId: string; // UUID for frontend polling
}

// ── Redis polling result ──────────────────────────────────────────────────────
export type PdfJobResult =
  | { status: 'pending' }
  | { status: 'done'; proposal_id: string; signed_url: string }
  | { status: 'failed'; error: string };
