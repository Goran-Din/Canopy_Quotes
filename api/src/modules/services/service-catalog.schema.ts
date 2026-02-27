import { z } from 'zod'

// ── Pricing Formula Schemas (discriminated union) ────────────────────

const FlatRateSqftSchema = z.object({
  type: z.literal('flat_rate_sqft'),
  rate_per_sqft: z.number().positive(),
  notes: z.string().max(500).optional(),
})

const TierSchema = z.object({
  from_sqft: z.number().int().min(0),
  to_sqft: z.number().int().positive().nullable(),
  rate_per_sqft: z.number().positive(),
})

const TieredSqftSchema = z.object({
  type: z.literal('tiered_sqft'),
  tiers: z.array(TierSchema).min(1),
})

const PerVisitSchema = z.object({
  type: z.literal('per_visit'),
  price_per_visit: z.number().positive(),
  notes: z.string().max(500).optional(),
})

const ProjectFixedSchema = z.object({
  type: z.literal('project_fixed'),
  notes: z.string().max(500).optional(),
})

export const PricingFormulaSchema = z.discriminatedUnion('type', [
  FlatRateSqftSchema,
  TieredSqftSchema,
  PerVisitSchema,
  ProjectFixedSchema,
])

export type PricingFormula = z.infer<typeof PricingFormulaSchema>

// ── Service Catalog Schemas ──────────────────────────────────────────

export const CreateServiceSchema = z.object({
  name: z.string().min(2).max(255),
  category: z.enum(['landscaping', 'snow', 'hardscape', 'project']),
  billing_unit: z.string().min(1).max(50),
  base_price_per_unit: z.number().min(0).optional(),
  pricing_formula: PricingFormulaSchema,
  min_price: z.number().min(0).optional(),
  description_template: z.string().max(1000).optional(),
  sort_order: z.number().int().min(0).optional(),
})

export type CreateServiceInput = z.infer<typeof CreateServiceSchema>

export const UpdateServiceSchema = CreateServiceSchema.partial()

export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>

export const ListServicesQuerySchema = z.object({
  category: z.enum(['landscaping', 'snow', 'hardscape', 'project']).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

// ── Calculate Price Schema ───────────────────────────────────────────

export const CalculatePriceSchema = z.object({
  measurement: z.number().positive(),
  measurement_unit: z.string().min(1).max(50),
})

export type CalculatePriceInput = z.infer<typeof CalculatePriceSchema>

// ── Pricing Rule Schemas ─────────────────────────────────────────────

const AppliesToSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('all') }),
  z.object({
    scope: z.literal('category'),
    category: z.enum(['landscaping', 'snow', 'hardscape', 'project']),
  }),
  z.object({
    scope: z.literal('service_ids'),
    service_ids: z.array(z.string().uuid()).min(1),
  }),
])

export const CreatePricingRuleSchema = z.object({
  name: z.string().min(2).max(255),
  rule_type: z.enum([
    'percentage_markup',
    'percentage_discount',
    'fixed_surcharge',
    'fixed_discount',
  ]),
  adjustment_value: z.number().positive(),
  applies_to: AppliesToSchema,
  is_active: z.boolean().default(true),
  valid_from: z.string().date().optional(),
  valid_until: z.string().date().optional(),
})

export type CreatePricingRuleInput = z.infer<typeof CreatePricingRuleSchema>

export const UpdatePricingRuleSchema = CreatePricingRuleSchema.partial()

export type UpdatePricingRuleInput = z.infer<typeof UpdatePricingRuleSchema>
