import { z } from 'zod'

// ── Create Quote (Step 3 — draft + placeholder line items) ───────────

const CreateLineItemSchema = z.object({
  service_catalog_id: z.string().uuid().nullable(),
  service_name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  quantity: z.number().min(0),
  unit: z.string().max(50),
  unit_price: z.number().min(0),
  line_total: z.number().min(0),
  frequency: z.string().max(255).optional(),
  sort_order: z.number().int().min(0),
})

export const CreateQuoteSchema = z.object({
  customer_id: z.string().uuid(),
  property_id: z.string().uuid(),
  service_type: z.enum([
    'landscaping_maintenance',
    'snow_removal',
    'hardscape',
    'project',
  ]),
  billing_type: z.enum([
    'monthly_fixed',
    'per_visit',
    'per_run',
    'project_fixed',
  ]),
  season_year: z.number().int().min(2024).max(2050).optional(),
  line_items: z.array(CreateLineItemSchema).min(1),
})

export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>

// ── Update Quote (draft only — partial update) ──────────────────────

export const UpdateQuoteSchema = z.object({
  discount_pct: z.number().min(0).max(100).optional(),
  notes_internal: z.string().max(2000).optional(),
  notes_client: z.string().max(2000).optional(),
  season_year: z.number().int().min(2024).max(2050).optional(),
})

export type UpdateQuoteInput = z.infer<typeof UpdateQuoteSchema>

// ── Batch Update Line Items (Step 4 → recalculate totals) ───────────

const UpdateLineItemEntrySchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().min(0),
  unit: z.string().max(50),
  unit_price: z.number().min(0),
  line_total: z.number().min(0),
  description: z.string().max(1000).optional(),
  frequency: z.string().max(255).optional(),
  sort_order: z.number().int().min(0),
})

export const UpdateLineItemsSchema = z.object({
  discount_pct: z.number().min(0).max(100).optional(),
  line_items: z.array(UpdateLineItemEntrySchema).min(1),
})

export type UpdateLineItemsInput = z.infer<typeof UpdateLineItemsSchema>

// ── Add Single Line Item ─────────────────────────────────────────────

export const AddLineItemSchema = CreateLineItemSchema

export type AddLineItemInput = z.infer<typeof AddLineItemSchema>

// ── Update Single Line Item ──────────────────────────────────────────

export const UpdateSingleLineItemSchema = z.object({
  quantity: z.number().min(0).optional(),
  unit: z.string().max(50).optional(),
  unit_price: z.number().min(0).optional(),
  line_total: z.number().min(0).optional(),
  description: z.string().max(1000).optional(),
  frequency: z.string().max(255).optional(),
  sort_order: z.number().int().min(0).optional(),
})

export type UpdateSingleLineItemInput = z.infer<typeof UpdateSingleLineItemSchema>

// ── Quote Status Update ──────────────────────────────────────────────

export const UpdateQuoteStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().max(500).optional(),
})

export type UpdateQuoteStatusInput = z.infer<typeof UpdateQuoteStatusSchema>

// ── List Quotes Query ────────────────────────────────────────────────

export const ListQuotesQuerySchema = z.object({
  status: z
    .enum(['draft', 'sent', 'approved', 'rejected', 'expired', 'converted'])
    .optional(),
  search: z.string().min(2).optional(),
  service_type: z
    .enum(['landscaping_maintenance', 'snow_removal', 'hardscape', 'project'])
    .optional(),
  salesperson_id: z.string().uuid().optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(['created_at', 'updated_at', 'total_amount']).default('updated_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export type ListQuotesQuery = z.infer<typeof ListQuotesQuerySchema>

// ── Quote Stats Query ────────────────────────────────────────────────

export const QuoteStatsQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})
