import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import type { AuthUser } from '../../middleware/authenticate.js'
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
} from './property.schema.js'

function formatProperty(p: {
  id: string
  customerId: string
  name: string
  type: string
  address: Prisma.JsonValue
  lawnAreaSqft: Prisma.Decimal | null
  parkingAreaSqft: Prisma.Decimal | null
  sidewalkLinearFt: Prisma.Decimal | null
  totalAreaSqft: Prisma.Decimal | null
  googleMapsUrl: string | null
  notes: string | null
  crmPropertyId: string | null
  createdAt: Date
}) {
  return {
    id: p.id,
    customer_id: p.customerId,
    name: p.name,
    type: p.type,
    address: p.address,
    lawn_area_sqft: p.lawnAreaSqft,
    parking_area_sqft: p.parkingAreaSqft,
    sidewalk_linear_ft: p.sidewalkLinearFt,
    total_area_sqft: p.totalAreaSqft,
    google_maps_url: p.googleMapsUrl,
    notes: p.notes,
    crm_property_id: p.crmPropertyId,
    created_at: p.createdAt,
  }
}

export async function listProperties(user: AuthUser, customerId: string) {
  // Verify customer belongs to tenant (and to salesperson if applicable)
  const customerWhere: Prisma.CustomerWhereInput = {
    id: customerId,
    tenantId: user.tenant_id,
  }
  if (user.role === 'salesperson' || user.role === 'coordinator') {
    customerWhere.createdBy = user.sub
  }

  const customer = await prisma.customer.findFirst({
    where: customerWhere,
    select: { id: true },
  })
  if (!customer) return { error: 'NOT_FOUND' as const }

  const properties = await prisma.property.findMany({
    where: { customerId, tenantId: user.tenant_id },
    orderBy: { createdAt: 'desc' },
  })

  return {
    properties: properties.map(formatProperty),
  }
}

export async function createProperty(
  user: AuthUser,
  customerId: string,
  input: CreatePropertyInput,
) {
  // Verify customer belongs to tenant
  const customerWhere: Prisma.CustomerWhereInput = {
    id: customerId,
    tenantId: user.tenant_id,
  }
  if (user.role === 'salesperson' || user.role === 'coordinator') {
    customerWhere.createdBy = user.sub
  }

  const customer = await prisma.customer.findFirst({
    where: customerWhere,
    select: { id: true },
  })
  if (!customer) return { error: 'CUSTOMER_NOT_FOUND' as const }

  const property = await prisma.property.create({
    data: {
      tenantId: user.tenant_id,
      customerId,
      name: input.name,
      type: input.type,
      address: input.address ?? Prisma.JsonNull,
      lawnAreaSqft: input.lawn_area_sqft ?? null,
      parkingAreaSqft: input.parking_area_sqft ?? null,
      sidewalkLinearFt: input.sidewalk_linear_ft ?? null,
      totalAreaSqft: input.total_area_sqft ?? null,
      googleMapsUrl: input.google_maps_url ?? null,
      notes: input.notes ?? null,
    },
  })

  return formatProperty(property)
}

export async function updateProperty(
  user: AuthUser,
  propertyId: string,
  input: UpdatePropertyInput,
) {
  // Verify property belongs to tenant and check ownership
  const property = await prisma.property.findFirst({
    where: { id: propertyId, tenantId: user.tenant_id },
    include: { customer: { select: { createdBy: true } } },
  })

  if (!property) return { error: 'NOT_FOUND' as const }

  if (user.role === 'coordinator') {
    return { error: 'FORBIDDEN' as const }
  }

  if (
    user.role === 'salesperson' &&
    property.customer.createdBy !== user.sub
  ) {
    return { error: 'FORBIDDEN' as const }
  }

  const data: Prisma.PropertyUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.type !== undefined) data.type = input.type
  if (input.address !== undefined)
    data.address = input.address ?? Prisma.JsonNull
  if (input.lawn_area_sqft !== undefined)
    data.lawnAreaSqft = input.lawn_area_sqft
  if (input.parking_area_sqft !== undefined)
    data.parkingAreaSqft = input.parking_area_sqft
  if (input.sidewalk_linear_ft !== undefined)
    data.sidewalkLinearFt = input.sidewalk_linear_ft
  if (input.total_area_sqft !== undefined)
    data.totalAreaSqft = input.total_area_sqft
  if (input.google_maps_url !== undefined)
    data.googleMapsUrl = input.google_maps_url
  if (input.notes !== undefined) data.notes = input.notes

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data,
  })

  return formatProperty(updated)
}
