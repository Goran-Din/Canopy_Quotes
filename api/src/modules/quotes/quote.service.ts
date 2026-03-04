import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import type { AuthUser } from '../../middleware/authenticate.js'
import type {
  CreateQuoteInput,
  UpdateQuoteInput,
  UpdateLineItemsInput,
  AddLineItemInput,
  UpdateSingleLineItemInput,
  UpdateQuoteStatusInput,
  ListQuotesQuery,
} from './quote.schema.js'

// ── Helpers ──────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const MAX_SALESPERSON_DISCOUNT = 15

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatLineItem(li: {
  id: string
  tenantId: string
  quoteId: string
  serviceCatalogId: string | null
  serviceName: string
  description: string | null
  quantity: Prisma.Decimal
  unit: string
  unitPrice: Prisma.Decimal
  lineTotal: Prisma.Decimal
  frequency: string | null
  sortOrder: number
}) {
  return {
    id: li.id,
    quote_id: li.quoteId,
    service_catalog_id: li.serviceCatalogId,
    service_name: li.serviceName,
    description: li.description,
    quantity: Number(li.quantity),
    unit: li.unit,
    unit_price: Number(li.unitPrice),
    line_total: Number(li.lineTotal),
    frequency: li.frequency,
    sort_order: li.sortOrder,
  }
}

function formatQuote(q: {
  id: string
  tenantId: string
  quoteNumber: string
  customerId: string
  propertyId: string
  createdBy: string
  serviceType: string
  seasonYear: number | null
  status: string
  billingType: string
  subtotal: Prisma.Decimal
  discountPct: Prisma.Decimal | null
  discountAmount: Prisma.Decimal | null
  totalAmount: Prisma.Decimal
  notesInternal: string | null
  notesClient: string | null
  validUntil: Date | null
  sentAt: Date | null
  approvedAt: Date | null
  crmJobId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: q.id,
    quote_number: q.quoteNumber,
    customer_id: q.customerId,
    property_id: q.propertyId,
    created_by: q.createdBy,
    service_type: q.serviceType,
    season_year: q.seasonYear,
    status: q.status,
    billing_type: q.billingType,
    subtotal: Number(q.subtotal),
    discount_pct: q.discountPct ? Number(q.discountPct) : null,
    discount_amount: q.discountAmount ? Number(q.discountAmount) : null,
    total_amount: Number(q.totalAmount),
    notes_internal: q.notesInternal,
    notes_client: q.notesClient,
    valid_until: q.validUntil,
    sent_at: q.sentAt,
    approved_at: q.approvedAt,
    crm_job_id: q.crmJobId,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
  }
}

/** Build role-scoped where clause for quote queries */
function buildScopeWhere(user: AuthUser): Prisma.QuoteWhereInput {
  const where: Prisma.QuoteWhereInput = { tenantId: user.tenant_id }
  if (user.role === 'salesperson' || user.role === 'coordinator') {
    where.createdBy = user.sub
  }
  return where
}

// ── Quote Number Generation ──────────────────────────────────────────

async function generateQuoteNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const startOfYear = new Date(`${year}-01-01T00:00:00Z`)
  const startOfNextYear = new Date(`${year + 1}-01-01T00:00:00Z`)

  const count = await prisma.quote.count({
    where: {
      tenantId,
      createdAt: { gte: startOfYear, lt: startOfNextYear },
    },
  })

  const nextNumber = count + 1
  return `SS-${year}-${String(nextNumber).padStart(4, '0')}`
}

// ── Recalculate Quote Totals ─────────────────────────────────────────

async function recalculateQuoteTotals(quoteId: string) {
  const lineItems = await prisma.quoteLineItem.findMany({
    where: { quoteId },
    select: { lineTotal: true },
  })

  const subtotal = lineItems.reduce(
    (sum, li) => sum + Number(li.lineTotal),
    0,
  )

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { discountPct: true },
  })

  const discountPct = quote?.discountPct ? Number(quote.discountPct) : 0
  const discountAmount = round2(subtotal * (discountPct / 100))
  const totalAmount = round2(subtotal - discountAmount)

  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      subtotal,
      discountAmount: discountAmount > 0 ? discountAmount : null,
      totalAmount,
    },
  })

  return { subtotal: round2(subtotal), discountAmount, totalAmount }
}

// ── Create Quote (Step 3 — draft + line items) ──────────────────────

export async function createQuote(user: AuthUser, input: CreateQuoteInput) {
  // Coordinators cannot create quotes
  if (user.role === 'coordinator') {
    return { error: 'FORBIDDEN' as const }
  }

  // Verify customer belongs to tenant and user has access
  const customerWhere: Prisma.CustomerWhereInput = {
    id: input.customer_id,
    tenantId: user.tenant_id,
  }
  if (user.role === 'salesperson') {
    customerWhere.createdBy = user.sub
  }

  const customer = await prisma.customer.findFirst({
    where: customerWhere,
    select: { id: true },
  })
  if (!customer) {
    return { error: 'CUSTOMER_NOT_FOUND' as const }
  }

  // Verify property belongs to customer and tenant
  const property = await prisma.property.findFirst({
    where: {
      id: input.property_id,
      customerId: input.customer_id,
      tenantId: user.tenant_id,
    },
    select: { id: true },
  })
  if (!property) {
    return { error: 'PROPERTY_NOT_FOUND' as const }
  }

  const quoteNumber = await generateQuoteNumber(user.tenant_id)

  // Create quote + line items in a single transaction
  const quote = await prisma.$transaction(async (tx) => {
    const q = await tx.quote.create({
      data: {
        tenantId: user.tenant_id,
        quoteNumber,
        customerId: input.customer_id,
        propertyId: input.property_id,
        createdBy: user.sub,
        serviceType: input.service_type,
        billingType: input.billing_type,
        seasonYear: input.season_year ?? null,
        status: 'draft',
        subtotal: 0,
        totalAmount: 0,
      },
    })

    await tx.quoteLineItem.createMany({
      data: input.line_items.map((li) => ({
        tenantId: user.tenant_id,
        quoteId: q.id,
        serviceCatalogId: li.service_catalog_id,
        serviceName: li.service_name,
        description: li.description ?? null,
        quantity: li.quantity,
        unit: li.unit,
        unitPrice: li.unit_price,
        lineTotal: li.line_total,
        frequency: li.frequency ?? null,
        sortOrder: li.sort_order,
      })),
    })

    const lineItems = await tx.quoteLineItem.findMany({
      where: { quoteId: q.id },
      orderBy: { sortOrder: 'asc' },
    })

    return { ...q, lineItems }
  })

  return {
    ...formatQuote(quote),
    line_items: quote.lineItems.map(formatLineItem),
  }
}

// ── List Quotes (paginated, filtered, role-scoped) ──────────────────

export async function listQuotes(user: AuthUser, query: ListQuotesQuery) {
  const where: Prisma.QuoteWhereInput = buildScopeWhere(user)

  if (query.status) {
    where.status = query.status
  }
  if (query.service_type) {
    where.serviceType = query.service_type
  }
  if (query.salesperson_id) {
    // Only owner/manager can filter by salesperson
    if (
      user.role === 'owner' ||
      user.role === 'n37_super_admin' ||
      user.role === 'division_manager'
    ) {
      where.createdBy = query.salesperson_id
    }
  }
  if (query.date_from || query.date_to) {
    where.createdAt = {}
    if (query.date_from) where.createdAt.gte = new Date(query.date_from)
    if (query.date_to) {
      const endDate = new Date(query.date_to)
      endDate.setDate(endDate.getDate() + 1)
      where.createdAt.lt = endDate
    }
  }
  if (query.search) {
    where.OR = [
      { quoteNumber: { contains: query.search, mode: 'insensitive' } },
      { customer: { name: { contains: query.search, mode: 'insensitive' } } },
    ]
  }

  const sortField =
    query.sort === 'total_amount' ? 'totalAmount' : query.sort === 'created_at' ? 'createdAt' : 'updatedAt'

  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, type: true } },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
        proposals: {
          where: { isCurrent: true },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { [sortField]: query.order },
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.quote.count({ where }),
  ])

  // Flag old drafts (older than 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  return {
    quotes: quotes.map((q) => ({
      ...formatQuote(q),
      is_old_draft:
        q.status === 'draft' && q.createdAt < sevenDaysAgo,
      customer: {
        id: q.customer.id,
        name: q.customer.name,
        type: q.customer.type,
      },
      property: {
        id: q.property.id,
        name: q.property.name,
        address: q.property.address,
      },
      salesperson: {
        id: q.creator.id,
        first_name: q.creator.firstName,
        last_name: q.creator.lastName,
      },
      proposal_id: q.proposals[0]?.id ?? null,
    })),
    pagination: {
      total,
      page: query.page,
      page_size: PAGE_SIZE,
      total_pages: Math.ceil(total / PAGE_SIZE),
    },
  }
}

// ── Get Quote by ID (full detail) ───────────────────────────────────

export async function getQuoteById(user: AuthUser, quoteId: string) {
  const where: Prisma.QuoteWhereInput = {
    id: quoteId,
    ...buildScopeWhere(user),
  }

  const quote = await prisma.quote.findFirst({
    where,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          type: true,
          billingEmail: true,
          phone: true,
          contactName: true,
        },
      },
      property: {
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
          lawnAreaSqft: true,
          parkingAreaSqft: true,
          sidewalkLinearFt: true,
          totalAreaSqft: true,
        },
      },
      creator: {
        select: { id: true, firstName: true, lastName: true },
      },
      lineItems: {
        orderBy: { sortOrder: 'asc' },
      },
      proposals: {
        where: { isCurrent: true },
        select: { id: true, version: true, generatedAt: true },
        take: 1,
      },
    },
  })

  if (!quote) return { error: 'NOT_FOUND' as const }

  return {
    ...formatQuote(quote),
    customer: {
      id: quote.customer.id,
      name: quote.customer.name,
      type: quote.customer.type,
      billing_email: quote.customer.billingEmail,
      phone: quote.customer.phone,
      contact_name: quote.customer.contactName,
    },
    property: {
      id: quote.property.id,
      name: quote.property.name,
      type: quote.property.type,
      address: quote.property.address,
      lawn_area_sqft: quote.property.lawnAreaSqft
        ? Number(quote.property.lawnAreaSqft)
        : null,
      parking_area_sqft: quote.property.parkingAreaSqft
        ? Number(quote.property.parkingAreaSqft)
        : null,
      sidewalk_linear_ft: quote.property.sidewalkLinearFt
        ? Number(quote.property.sidewalkLinearFt)
        : null,
      total_area_sqft: quote.property.totalAreaSqft
        ? Number(quote.property.totalAreaSqft)
        : null,
    },
    salesperson: {
      id: quote.creator.id,
      first_name: quote.creator.firstName,
      last_name: quote.creator.lastName,
    },
    line_items: quote.lineItems.map(formatLineItem),
    current_proposal: quote.proposals[0]
      ? {
          id: quote.proposals[0].id,
          version: quote.proposals[0].version,
          generated_at: quote.proposals[0].generatedAt,
        }
      : null,
  }
}

// ── Update Quote (draft only) ────────────────────────────────────────

export async function updateQuote(
  user: AuthUser,
  quoteId: string,
  input: UpdateQuoteInput,
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...buildScopeWhere(user) },
  })

  if (!quote) return { error: 'NOT_FOUND' as const }

  if (quote.status !== 'draft') {
    return { error: 'NOT_DRAFT' as const }
  }

  // Enforce salesperson discount limit (max 15%)
  if (
    input.discount_pct !== undefined &&
    input.discount_pct > MAX_SALESPERSON_DISCOUNT &&
    user.role === 'salesperson'
  ) {
    return {
      error: 'DISCOUNT_EXCEEDED' as const,
      message: `Salesperson discount cannot exceed ${MAX_SALESPERSON_DISCOUNT}%. Request manager approval for higher discounts.`,
    }
  }

  const data: Prisma.QuoteUpdateInput = {}
  if (input.discount_pct !== undefined) data.discountPct = input.discount_pct
  if (input.notes_internal !== undefined) data.notesInternal = input.notes_internal
  if (input.notes_client !== undefined) data.notesClient = input.notes_client
  if (input.season_year !== undefined) data.seasonYear = input.season_year

  await prisma.quote.update({
    where: { id: quoteId },
    data,
  })

  // Recalculate totals if discount changed
  if (input.discount_pct !== undefined) {
    await recalculateQuoteTotals(quoteId)
  }

  const refreshed = await prisma.quote.findUnique({ where: { id: quoteId } })
  return formatQuote(refreshed!)
}

// ── Delete Quote (draft only) ────────────────────────────────────────

export async function deleteQuote(user: AuthUser, quoteId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...buildScopeWhere(user) },
  })

  if (!quote) return { error: 'NOT_FOUND' as const }

  if (quote.status !== 'draft') {
    return { error: 'NOT_DRAFT' as const }
  }

  // Only owner/manager can delete others' drafts
  if (
    quote.createdBy !== user.sub &&
    user.role !== 'owner' &&
    user.role !== 'n37_super_admin' &&
    user.role !== 'division_manager'
  ) {
    return { error: 'FORBIDDEN' as const }
  }

  // Cascade deletes line items and proposals via Prisma relations
  await prisma.quote.delete({ where: { id: quoteId } })

  return { message: `Draft quote ${quote.quoteNumber} deleted.` }
}

// ── Batch Update Line Items (Step 4) ─────────────────────────────────

export async function updateLineItems(
  user: AuthUser,
  quoteId: string,
  input: UpdateLineItemsInput,
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...buildScopeWhere(user) },
  })

  if (!quote) return { error: 'NOT_FOUND' as const }
  if (quote.status !== 'draft') return { error: 'NOT_DRAFT' as const }

  // Enforce salesperson discount limit
  if (
    input.discount_pct !== undefined &&
    input.discount_pct > MAX_SALESPERSON_DISCOUNT &&
    user.role === 'salesperson'
  ) {
    return {
      error: 'DISCOUNT_EXCEEDED' as const,
      message: `Salesperson discount cannot exceed ${MAX_SALESPERSON_DISCOUNT}%. Request manager approval for higher discounts.`,
    }
  }

  await prisma.$transaction(async (tx) => {
    // Update discount if provided
    if (input.discount_pct !== undefined) {
      await tx.quote.update({
        where: { id: quoteId },
        data: { discountPct: input.discount_pct },
      })
    }

    // Update each line item
    for (const li of input.line_items) {
      await tx.quoteLineItem.update({
        where: { id: li.id },
        data: {
          quantity: li.quantity,
          unit: li.unit,
          unitPrice: li.unit_price,
          lineTotal: li.line_total,
          description: li.description ?? undefined,
          frequency: li.frequency ?? undefined,
          sortOrder: li.sort_order,
        },
      })
    }
  })

  // Recalculate totals
  const totals = await recalculateQuoteTotals(quoteId)

  const discountPct = input.discount_pct ?? (quote.discountPct ? Number(quote.discountPct) : 0)

  return {
    quote_id: quoteId,
    subtotal: totals.subtotal,
    discount_pct: discountPct,
    discount_amount: totals.discountAmount,
    total_amount: totals.totalAmount,
  }
}

// ── Add Single Line Item ─────────────────────────────────────────────

export async function addLineItem(
  user: AuthUser,
  quoteId: string,
  input: AddLineItemInput,
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...buildScopeWhere(user) },
  })

  if (!quote) return { error: 'NOT_FOUND' as const }
  if (quote.status !== 'draft') return { error: 'NOT_DRAFT' as const }

  const lineItem = await prisma.quoteLineItem.create({
    data: {
      tenantId: user.tenant_id,
      quoteId,
      serviceCatalogId: input.service_catalog_id,
      serviceName: input.service_name,
      description: input.description ?? null,
      quantity: input.quantity,
      unit: input.unit,
      unitPrice: input.unit_price,
      lineTotal: input.line_total,
      frequency: input.frequency ?? null,
      sortOrder: input.sort_order,
    },
  })

  await recalculateQuoteTotals(quoteId)

  return formatLineItem(lineItem)
}

// ── Update Single Line Item ──────────────────────────────────────────

export async function updateSingleLineItem(
  user: AuthUser,
  quoteId: string,
  lineItemId: string,
  input: UpdateSingleLineItemInput,
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...buildScopeWhere(user) },
  })

  if (!quote) return { error: 'QUOTE_NOT_FOUND' as const }
  if (quote.status !== 'draft') return { error: 'NOT_DRAFT' as const }

  const lineItem = await prisma.quoteLineItem.findFirst({
    where: { id: lineItemId, quoteId },
  })

  if (!lineItem) return { error: 'NOT_FOUND' as const }

  const data: Prisma.QuoteLineItemUpdateInput = {}
  if (input.quantity !== undefined) data.quantity = input.quantity
  if (input.unit !== undefined) data.unit = input.unit
  if (input.unit_price !== undefined) data.unitPrice = input.unit_price
  if (input.line_total !== undefined) data.lineTotal = input.line_total
  if (input.description !== undefined) data.description = input.description
  if (input.frequency !== undefined) data.frequency = input.frequency
  if (input.sort_order !== undefined) data.sortOrder = input.sort_order

  const updated = await prisma.quoteLineItem.update({
    where: { id: lineItemId },
    data,
  })

  await recalculateQuoteTotals(quoteId)

  return formatLineItem(updated)
}

// ── Delete Single Line Item ──────────────────────────────────────────

export async function deleteLineItem(
  user: AuthUser,
  quoteId: string,
  lineItemId: string,
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...buildScopeWhere(user) },
  })

  if (!quote) return { error: 'QUOTE_NOT_FOUND' as const }
  if (quote.status !== 'draft') return { error: 'NOT_DRAFT' as const }

  const lineItem = await prisma.quoteLineItem.findFirst({
    where: { id: lineItemId, quoteId },
  })

  if (!lineItem) return { error: 'NOT_FOUND' as const }

  await prisma.quoteLineItem.delete({ where: { id: lineItemId } })

  await recalculateQuoteTotals(quoteId)

  return { message: 'Line item deleted.' }
}

// ── Update Quote Status ──────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent'],
  sent: ['approved', 'rejected', 'expired'],
  approved: ['converted'],
  rejected: [],
  expired: [],
  converted: [],
}

export async function updateQuoteStatus(
  user: AuthUser,
  quoteId: string,
  input: UpdateQuoteStatusInput,
) {
  // Only owner/division_manager can approve/reject
  if (
    user.role !== 'owner' &&
    user.role !== 'n37_super_admin' &&
    user.role !== 'division_manager'
  ) {
    return { error: 'FORBIDDEN' as const }
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, tenantId: user.tenant_id },
  })

  if (!quote) return { error: 'NOT_FOUND' as const }

  const allowed = VALID_TRANSITIONS[quote.status] ?? []
  if (!allowed.includes(input.status)) {
    return {
      error: 'INVALID_TRANSITION' as const,
      message: `Cannot transition from '${quote.status}' to '${input.status}'`,
    }
  }

  const data: Prisma.QuoteUpdateInput = { status: input.status }

  if (input.status === 'approved') {
    data.approvedAt = new Date()
  }

  if (input.note) {
    // Append status note to internal notes
    const existing = quote.notesInternal ?? ''
    const prefix = existing ? `${existing}\n` : ''
    data.notesInternal = `${prefix}[${input.status.toUpperCase()}] ${input.note}`
  }

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data,
  })

  return {
    id: updated.id,
    quote_number: updated.quoteNumber,
    status: updated.status,
    approved_at: updated.approvedAt,
  }
}

// ── Duplicate Quote ──────────────────────────────────────────────────

export async function duplicateQuote(user: AuthUser, quoteId: string) {
  if (user.role === 'coordinator') {
    return { error: 'FORBIDDEN' as const }
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, ...buildScopeWhere(user) },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!quote) return { error: 'NOT_FOUND' as const }

  const quoteNumber = await generateQuoteNumber(user.tenant_id)

  const newQuote = await prisma.$transaction(async (tx) => {
    const q = await tx.quote.create({
      data: {
        tenantId: user.tenant_id,
        quoteNumber,
        customerId: quote.customerId,
        propertyId: quote.propertyId,
        createdBy: user.sub,
        serviceType: quote.serviceType,
        billingType: quote.billingType,
        seasonYear: quote.seasonYear,
        status: 'draft',
        subtotal: quote.subtotal,
        discountPct: quote.discountPct,
        discountAmount: quote.discountAmount,
        totalAmount: quote.totalAmount,
        notesInternal: null,
        notesClient: quote.notesClient,
      },
    })

    if (quote.lineItems.length > 0) {
      await tx.quoteLineItem.createMany({
        data: quote.lineItems.map((li) => ({
          tenantId: user.tenant_id,
          quoteId: q.id,
          serviceCatalogId: li.serviceCatalogId,
          serviceName: li.serviceName,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          unitPrice: li.unitPrice,
          lineTotal: li.lineTotal,
          frequency: li.frequency,
          sortOrder: li.sortOrder,
        })),
      })
    }

    const lineItems = await tx.quoteLineItem.findMany({
      where: { quoteId: q.id },
      orderBy: { sortOrder: 'asc' },
    })

    return { ...q, lineItems }
  })

  return {
    ...formatQuote(newQuote),
    line_items: newQuote.lineItems.map(formatLineItem),
  }
}

// ── Quote Stats (Dashboard) ──────────────────────────────────────────

export async function getQuoteStats(user: AuthUser, month?: string) {
  const now = new Date()
  const targetMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [yearStr, monthStr] = targetMonth.split('-')
  const year = parseInt(yearStr!)
  const mon = parseInt(monthStr!)
  const startOfMonth = new Date(year, mon - 1, 1)
  const startOfNextMonth = new Date(year, mon, 1)

  const baseWhere: Prisma.QuoteWhereInput = buildScopeWhere(user)

  const thisMonthWhere: Prisma.QuoteWhereInput = {
    ...baseWhere,
    createdAt: { gte: startOfMonth, lt: startOfNextMonth },
  }

  const [totalThisMonth, pendingCount, approvedCount, sentQuotes, expiringCount] =
    await Promise.all([
      prisma.quote.count({ where: thisMonthWhere }),
      prisma.quote.count({
        where: { ...baseWhere, status: { in: ['draft', 'sent'] } },
      }),
      prisma.quote.count({
        where: {
          ...baseWhere,
          status: 'approved',
          approvedAt: { gte: startOfMonth, lt: startOfNextMonth },
        },
      }),
      prisma.quote.aggregate({
        where: { ...baseWhere, status: 'sent' },
        _sum: { totalAmount: true },
      }),
      prisma.quote.count({
        where: {
          ...baseWhere,
          status: 'sent',
          validUntil: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ])

  return {
    period: targetMonth,
    total_quotes_this_month: totalThisMonth,
    pending_count: pendingCount,
    approved_count: approvedCount,
    total_value_sent: sentQuotes._sum.totalAmount
      ? Number(sentQuotes._sum.totalAmount)
      : 0,
    expiring_soon_count: expiringCount,
  }
}
