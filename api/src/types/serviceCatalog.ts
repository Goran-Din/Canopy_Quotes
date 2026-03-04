import { z } from 'zod';

// ── Service categories ────────────────────────────────────────────────────────
export type ServiceCategory = 'landscaping' | 'snow' | 'hardscape' | 'project';

// ── Pricing formula schemas (Zod) ─────────────────────────────────────────────
export const FlatRateSqftFormulaSchema = z.object({
  type: z.literal('flat_rate_sqft'),
  rate_per_sqft: z.number().positive(),
});

export const TierSchema = z.object({
  from_sqft: z.number().nonnegative(),
  to_sqft: z.number().positive().nullable(), // null = infinity (last tier)
  rate_per_sqft: z.number().positive(),
});

export const TieredSqftFormulaSchema = z.object({
  type: z.literal('tiered_sqft'),
  tiers: z.array(TierSchema).min(1),
});

export const PerVisitFormulaSchema = z.object({
  type: z.literal('per_visit'),
  price_per_visit: z.number().positive(),
});

export const ProjectFixedFormulaSchema = z.object({
  type: z.literal('project_fixed'),
  // No formula fields — salesperson enters price manually at quote time
});

export const PerQuantityFormulaSchema = z.object({
  type: z.literal('per_quantity'),
  rate_per_unit: z.number().positive(),
  unit_label: z.string().min(1).max(50),
});

export const PricingFormulaSchema = z.discriminatedUnion('type', [
  FlatRateSqftFormulaSchema,
  TieredSqftFormulaSchema,
  PerVisitFormulaSchema,
  ProjectFixedFormulaSchema,
  PerQuantityFormulaSchema,
]);

export type PricingFormula = z.infer<typeof PricingFormulaSchema>;
export type Tier = z.infer<typeof TierSchema>;

// ── Public shape (returned to salesperson — NO pricing_formula) ───────────────
export interface ServiceCatalogPublic {
  id: string;
  name: string;
  category: ServiceCategory;
  billing_unit: string;
  description_template: string | null;
  sort_order: number;
}

// ── Full shape (Owner only — includes formula and pricing details) ─────────────
export interface ServiceCatalogFull extends ServiceCatalogPublic {
  base_price_per_unit: number | null;
  pricing_formula: PricingFormula;
  min_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Price calculation result ──────────────────────────────────────────────────
export interface PriceCalculation {
  unit_price: number;
  line_total: number;
  min_price_applied: boolean;
  formula_type: string;
  pricing_rule_applied: boolean;
}

// ── Pricing rule (from pricing_rules table) ───────────────────────────────────
export interface PricingRule {
  id: string;
  tenant_id: string;
  name: string;
  rule_type: 'percentage_markup' | 'percentage_discount' | 'fixed_surcharge' | 'fixed_discount';
  adjustment_value: number;
  applies_to: PricingRuleScope;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

export interface PricingRuleScope {
  scope: 'all' | 'category' | 'service_ids';
  category?: ServiceCategory;
  service_ids?: string[];
}

// ── DTOs ─────────────────────────────────────────────────────────────────────
export interface CreateServiceDto {
  name: string;
  category: ServiceCategory;
  billing_unit: string;
  base_price_per_unit?: number;
  pricing_formula: PricingFormula;
  min_price?: number;
  description_template?: string;
  sort_order?: number;
}

export interface UpdateServiceDto {
  name?: string;
  category?: ServiceCategory;
  billing_unit?: string;
  base_price_per_unit?: number;
  pricing_formula?: PricingFormula;
  min_price?: number | null;
  description_template?: string | null;
  sort_order?: number;
}
