// ============================================================
// Canopy Quotes – Quote Builder Types
// ============================================================

export type ServiceType = 'landscaping_maintenance' | 'snow_removal' | 'hardscape' | 'project';
export type BillingType = 'monthly_fixed' | 'per_visit' | 'per_run' | 'project_fixed';

export interface WizardCustomer {
  id: string;
  name: string;
  type: 'residential' | 'commercial';
  status: string;
  billing_email?: string;
  phone?: string;
  property_count: number;
}

export interface PropertyAddress {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface WizardProperty {
  id: string;
  customer_id: string;
  name: string;
  type: string;
  address?: PropertyAddress | null;
  lawn_area_sqft?: number | null;
  parking_area_sqft?: number | null;
  sidewalk_linear_ft?: number | null;
  total_area_sqft?: number | null;
  google_maps_url?: string | null;
  notes?: string | null;
}

export interface CatalogService {
  id: string;
  name: string;
  category: string;
  billing_unit: string;
  description_template?: string;
  sort_order: number;
}

export interface WizardLineItem {
  id?: string; // DB record UUID (set after quote draft is created)
  service_catalog_id: string;
  service_name: string;
  billing_unit: string;
  description: string;
  frequency: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  suggested_total: number; // formula-calculated price before agent override
  min_price_applied: boolean;
  formula_type: string;
  sort_order: number;
}

export interface PriceCalcResult {
  unit_price: number;
  line_total: number;
  min_price_applied: boolean;
  formula_type: string;
}

// The full wizard state stored in Zustand
export interface QuoteWizardState {
  // Step tracking
  currentStep: number; // 1-5

  // Step 1 – Customer
  customer: WizardCustomer | null;

  // Step 2 – Property
  property: WizardProperty | null;

  // Step 3 – Service type & services
  serviceType: ServiceType | null;
  billingType: BillingType | null;
  seasonYear: number | null;
  selectedServices: CatalogService[];

  // Step 4 – Line items with measurements & pricing
  lineItems: WizardLineItem[];
  discountPct: number;

  // After Step 3 DB write
  quoteId: string | null;
  quoteNumber: string | null;

  // Step 5 – Notes
  notesInternal: string;
  notesClient: string;
  sendToEmail: string;

  // UI state
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
}
