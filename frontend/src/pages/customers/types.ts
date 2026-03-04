// ============================================================
// Canopy Quotes – Customer & Property Types
// ============================================================

export type CustomerType = 'residential' | 'commercial';
export type CustomerStatus = 'active' | 'prospect' | 'inactive';

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  status: CustomerStatus;
  contact_name?: string;
  billing_email?: string;
  phone?: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  notes?: string;
  property_count: number;
  quote_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  customer_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: 'residential' | 'commercial';
  lot_size_sqft?: number;
  turf_sqft?: number;
  bed_sqft?: number;
  shrub_count?: number;
  notes?: string;
  access_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerListResponse {
  customers: Customer[];
  pagination: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}

export interface CustomerFilters {
  search: string;
  type: '' | CustomerType;
  status: '' | CustomerStatus;
  page: number;
}

export interface NewCustomerForm {
  name: string;
  type: CustomerType;
  contact_name: string;
  billing_email: string;
  phone: string;
  billing_address: string;
  billing_city: string;
  billing_state: string;
  billing_zip: string;
  notes: string;
}

export interface NewPropertyForm {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: 'residential' | 'commercial';
  lot_size_sqft: string;
  turf_sqft: string;
  bed_sqft: string;
  shrub_count: string;
  notes: string;
  access_notes: string;
}
