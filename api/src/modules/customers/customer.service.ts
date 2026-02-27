import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import type { AuthUser } from '../../middleware/authenticate.js'
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersQuery,
} from './customer.schema.js'

const PAGE_SIZE = 10

export async function listCustomers(
  user: AuthUser,
  query: ListCustomersQuery,
) {
  const where: Prisma.CustomerWhereInput = {
    tenantId: user.tenant_id,
  }

  // Salesperson sees only their own customers
  if (user.role === 'salesperson' || user.role === 'coordinator') {
    where.createdBy = user.sub
  }

  if (query.type) where.type = query.type
  if (query.status) where.status = query.status
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { billingEmail: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
    ]
  }

  const orderBy: Prisma.CustomerOrderByWithRelationInput = {
    [query.sort === 'name' ? 'name' : query.sort === 'created_at' ? 'createdAt' : 'updatedAt']:
      query.order,
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        contactName: true,
        billingEmail: true,
        phone: true,
        createdAt: true,
        _count: { select: { properties: true } },
      },
    }),
    prisma.customer.count({ where }),
  ])

  return {
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      contact_name: c.contactName,
      billing_email: c.billingEmail,
      phone: c.phone,
      property_count: c._count.properties,
      created_at: c.createdAt,
    })),
    pagination: {
      total,
      page: query.page,
      page_size: PAGE_SIZE,
      total_pages: Math.ceil(total / PAGE_SIZE),
    },
  }
}

export async function getCustomerById(user: AuthUser, customerId: string) {
  const where: Prisma.CustomerWhereInput = {
    id: customerId,
    tenantId: user.tenant_id,
  }

  if (user.role === 'salesperson' || user.role === 'coordinator') {
    where.createdBy = user.sub
  }

  const customer = await prisma.customer.findFirst({
    where,
    include: {
      properties: {
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
          lawnAreaSqft: true,
          parkingAreaSqft: true,
          sidewalkLinearFt: true,
          totalAreaSqft: true,
          createdAt: true,
        },
      },
    },
  })

  if (!customer) return null

  // Quote summary
  const quoteWhere: Prisma.QuoteWhereInput = {
    tenantId: user.tenant_id,
    customerId,
  }

  const [totalQuotes, openQuotes, approvedQuotes, lastQuote] =
    await Promise.all([
      prisma.quote.count({ where: quoteWhere }),
      prisma.quote.count({
        where: { ...quoteWhere, status: { in: ['draft', 'sent'] } },
      }),
      prisma.quote.count({
        where: { ...quoteWhere, status: 'approved' },
      }),
      prisma.quote.findFirst({
        where: quoteWhere,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

  return {
    id: customer.id,
    name: customer.name,
    type: customer.type,
    status: customer.status,
    contact_name: customer.contactName,
    billing_email: customer.billingEmail,
    phone: customer.phone,
    billing_address: customer.billingAddress,
    notes: customer.notes,
    crm_customer_id: customer.crmCustomerId,
    properties: customer.properties.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address,
      lawn_area_sqft: p.lawnAreaSqft,
      parking_area_sqft: p.parkingAreaSqft,
      sidewalk_linear_ft: p.sidewalkLinearFt,
      total_area_sqft: p.totalAreaSqft,
      created_at: p.createdAt,
    })),
    quote_summary: {
      total_quotes: totalQuotes,
      open_quotes: openQuotes,
      approved_quotes: approvedQuotes,
      last_quote_date: lastQuote?.createdAt.toISOString().slice(0, 10) ?? null,
    },
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
  }
}

export async function createCustomer(
  user: AuthUser,
  input: CreateCustomerInput,
) {
  const customer = await prisma.customer.create({
    data: {
      tenantId: user.tenant_id,
      name: input.name,
      type: input.type,
      status: input.status ?? 'prospect',
      contactName: input.contact_name ?? null,
      billingEmail: input.billing_email ?? null,
      phone: input.phone ?? null,
      billingAddress: input.billing_address ?? Prisma.JsonNull,
      notes: input.notes ?? null,
      createdBy: user.sub,
    },
  })

  return {
    id: customer.id,
    name: customer.name,
    type: customer.type,
    status: customer.status,
    contact_name: customer.contactName,
    billing_email: customer.billingEmail,
    phone: customer.phone,
    billing_address: customer.billingAddress,
    notes: customer.notes,
    crm_customer_id: customer.crmCustomerId,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
  }
}

export async function updateCustomer(
  user: AuthUser,
  customerId: string,
  input: UpdateCustomerInput,
) {
  // Verify ownership / access
  const where: Prisma.CustomerWhereInput = {
    id: customerId,
    tenantId: user.tenant_id,
  }

  if (user.role === 'salesperson') {
    where.createdBy = user.sub
  }
  if (user.role === 'coordinator') {
    return { error: 'FORBIDDEN' as const }
  }

  const existing = await prisma.customer.findFirst({ where })
  if (!existing) return { error: 'NOT_FOUND' as const }

  const data: Prisma.CustomerUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.type !== undefined) data.type = input.type
  if (input.status !== undefined) data.status = input.status
  if (input.contact_name !== undefined) data.contactName = input.contact_name
  if (input.billing_email !== undefined) data.billingEmail = input.billing_email
  if (input.phone !== undefined) data.phone = input.phone
  if (input.billing_address !== undefined)
    data.billingAddress = input.billing_address ?? Prisma.JsonNull
  if (input.notes !== undefined) data.notes = input.notes

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data,
  })

  return {
    id: customer.id,
    name: customer.name,
    type: customer.type,
    status: customer.status,
    contact_name: customer.contactName,
    billing_email: customer.billingEmail,
    phone: customer.phone,
    billing_address: customer.billingAddress,
    notes: customer.notes,
    crm_customer_id: customer.crmCustomerId,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
  }
}
