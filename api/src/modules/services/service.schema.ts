import { z } from 'zod';
import { PricingFormulaSchema } from '../../types/serviceCatalog.js';

const SERVICE_CATEGORIES = ['landscaping', 'snow', 'hardscape', 'project'] as const;
// ── Service schemas ───────────────────────────────────────────────────────────

export const CreateServiceSchema = z.object({
  name: z.string().min(2).max(255),
  category: z.enum(SERVICE_CATEGORIES),
  billing_unit: z.string().min(1).max(50),
  base_price_per_unit: z.number().positive().optional(),
  pricing_formula: PricingFormulaSchema,
  min_price: z.number().positive().optional(),
  description_template: z.string().max(1000).optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export const UpdateServiceSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  category: z.enum(SERVICE_CATEGORIES).optional(),
  billing_unit: z.string().min(1).max(50).optional(),
  base_price_per_unit: z.number().positive().optional(),
  pricing_formula: PricingFormulaSchema.optional(),
  min_price: z.number().positive().nullable().optional(),
  description_template: z.string().max(1000).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export const CalculatePriceSchema = z.object({
  measurement: z.number().positive({ message: 'Measurement must be greater than 0' }),
  measurement_unit: z.string().min(1),
});

// ── Pricing rule schemas ──────────────────────────────────────────────────────

export const AppliestoSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('all') }),
  z.object({ scope: z.literal('category'), category: z.enum(SERVICE_CATEGORIES) }),
  z.object({ scope: z.literal('service_ids'), service_ids: z.array(z.string().uuid()).min(1) }),
]);

export const CreatePricingRuleSchema = z.object({
  name: z.string().min(2).max(255),
  rule_type: z.enum(['percentage_markup', 'percentage_discount', 'fixed_surcharge', 'fixed_discount']),
  adjustment_value: z.number().positive(),
  applies_to: AppliestoSchema,
  is_active: z.boolean().default(true),
  valid_from: z.string().date().optional(),
  valid_until: z.string().date().optional(),
});

export const UpdatePricingRuleSchema = CreatePricingRuleSchema.partial();

// ── List query schema ─────────────────────────────────────────────────────────
export const ListServicesQuerySchema = z.object({
  category: z.enum(SERVICE_CATEGORIES).optional(),
  active: z.string().optional(), // 'true' | 'false' — parsed as string from query params
});
