import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import type { AuthUser } from '../../middleware/authenticate.js'
import type {
  CreateServiceInput,
  UpdateServiceInput,
} from './service-catalog.schema.js'

// ── Helpers ──────────────────────────────────────────────────────────

type ServiceRow = Awaited<ReturnType<typeof prisma.serviceCatalog.findFirst>> & object

/** Public format — pricing_formula, base_price_per_unit, min_price OMITTED */
function formatPublic(s: ServiceRow) {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    billing_unit: s.billingUnit,
    description_template: s.descriptionTemplate,
    sort_order: s.sortOrder,
    is_active: s.isActive,
  }
}

/** Full format — includes pricing details. Owner only. */
function formatFull(s: ServiceRow) {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    billing_unit: s.billingUnit,
    base_price_per_unit: s.basePricePerUnit ? Number(s.basePricePerUnit) : null,
    pricing_formula: s.pricingFormula,
    min_price: s.minPrice ? Number(s.minPrice) : null,
    description_template: s.descriptionTemplate,
    is_active: s.isActive,
    sort_order: s.sortOrder,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }
}

function isOwnerRole(role: string): boolean {
  return role === 'owner' || role === 'n37_super_admin'
}

// ── Tier Validation ──────────────────────────────────────────────────

interface Tier {
  from_sqft: number
  to_sqft: number | null
  rate_per_sqft: number
}

function validateTierContinuity(tiers: Tier[]): string | null {
  for (let i = 1; i < tiers.length; i++) {
    const prev = tiers[i - 1]!
    const curr = tiers[i]!

    if (prev.to_sqft === null) {
      return 'Only the last tier can have no upper limit (to_sqft: null)'
    }
    if (curr.from_sqft !== prev.to_sqft + 1) {
      return `Tier gap detected: tier ${i + 1} starts at ${curr.from_sqft} but previous tier ends at ${prev.to_sqft}`
    }
  }

  if (tiers[tiers.length - 1]!.to_sqft !== null) {
    return 'The last tier must have to_sqft set to null (no upper limit)'
  }

  return null
}

function validateBillingUnitForFormula(
  unit: string,
  formulaType: string,
): string | null {
  const sqftFormulas = ['flat_rate_sqft', 'tiered_sqft']
  if (sqftFormulas.includes(formulaType) && unit !== 'sqft' && unit !== 'linear_ft') {
    return `Formula type '${formulaType}' requires billing_unit of 'sqft' or 'linear_ft'`
  }
  if (formulaType === 'project_fixed' && unit !== 'project') {
    return "Formula type 'project_fixed' requires billing_unit 'project'"
  }
  return null
}

// ── Read Operations (all authenticated users) ────────────────────────

export async function listServices(
  user: AuthUser,
  category?: string,
  active?: boolean,
) {
  const where: Prisma.ServiceCatalogWhereInput = {
    tenantId: user.tenant_id,
  }

  if (category) {
    where.category = category as Prisma.EnumServiceCategoryFilter
  }

  // Non-owners always see only active services
  if (!isOwnerRole(user.role)) {
    where.isActive = true
  } else if (active !== undefined) {
    where.isActive = active
  }

  const services = await prisma.serviceCatalog.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  // Non-owners get public format (no pricing details)
  if (!isOwnerRole(user.role)) {
    return { services: services.map(formatPublic) }
  }

  return { services: services.map(formatFull) }
}

export async function getServiceById(user: AuthUser, serviceId: string) {
  if (!isOwnerRole(user.role)) {
    return { error: 'FORBIDDEN' as const }
  }

  const service = await prisma.serviceCatalog.findFirst({
    where: { id: serviceId, tenantId: user.tenant_id },
  })

  if (!service) return { error: 'NOT_FOUND' as const }

  return formatFull(service)
}

// ── Write Operations (Owner only) ────────────────────────────────────

export async function createService(
  user: AuthUser,
  input: CreateServiceInput,
) {
  if (!isOwnerRole(user.role)) {
    return { error: 'FORBIDDEN' as const }
  }

  // Validate tier continuity for tiered formulas
  if (input.pricing_formula.type === 'tiered_sqft') {
    const tierError = validateTierContinuity(input.pricing_formula.tiers)
    if (tierError) return { error: 'VALIDATION_ERROR' as const, message: tierError }
  }

  // Validate billing_unit matches formula type
  const unitError = validateBillingUnitForFormula(
    input.billing_unit,
    input.pricing_formula.type,
  )
  if (unitError) return { error: 'VALIDATION_ERROR' as const, message: unitError }

  // Check for duplicate name within tenant
  const existing = await prisma.serviceCatalog.findFirst({
    where: { tenantId: user.tenant_id, name: input.name },
    select: { id: true },
  })
  if (existing) {
    return {
      error: 'CONFLICT' as const,
      message: `A service named '${input.name}' already exists`,
    }
  }

  const service = await prisma.serviceCatalog.create({
    data: {
      tenantId: user.tenant_id,
      name: input.name,
      category: input.category,
      billingUnit: input.billing_unit,
      basePricePerUnit: input.base_price_per_unit ?? null,
      pricingFormula: input.pricing_formula as unknown as Prisma.JsonObject,
      minPrice: input.min_price ?? null,
      descriptionTemplate: input.description_template ?? null,
      sortOrder: input.sort_order ?? 0,
    },
  })

  return formatFull(service)
}

export async function updateService(
  user: AuthUser,
  serviceId: string,
  input: UpdateServiceInput,
) {
  if (!isOwnerRole(user.role)) {
    return { error: 'FORBIDDEN' as const }
  }

  const existing = await prisma.serviceCatalog.findFirst({
    where: { id: serviceId, tenantId: user.tenant_id },
  })
  if (!existing) return { error: 'NOT_FOUND' as const }

  // If pricing_formula is being updated, validate it
  if (input.pricing_formula) {
    if (input.pricing_formula.type === 'tiered_sqft') {
      const tierError = validateTierContinuity(input.pricing_formula.tiers)
      if (tierError) return { error: 'VALIDATION_ERROR' as const, message: tierError }
    }

    const billingUnit = input.billing_unit ?? existing.billingUnit
    const unitError = validateBillingUnitForFormula(
      billingUnit,
      input.pricing_formula.type,
    )
    if (unitError) return { error: 'VALIDATION_ERROR' as const, message: unitError }
  }

  // Check duplicate name if name is being changed
  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.serviceCatalog.findFirst({
      where: {
        tenantId: user.tenant_id,
        name: input.name,
        NOT: { id: serviceId },
      },
      select: { id: true },
    })
    if (duplicate) {
      return {
        error: 'CONFLICT' as const,
        message: `A service named '${input.name}' already exists`,
      }
    }
  }

  const data: Prisma.ServiceCatalogUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.category !== undefined) data.category = input.category
  if (input.billing_unit !== undefined) data.billingUnit = input.billing_unit
  if (input.base_price_per_unit !== undefined)
    data.basePricePerUnit = input.base_price_per_unit
  if (input.pricing_formula !== undefined)
    data.pricingFormula = input.pricing_formula as unknown as Prisma.JsonObject
  if (input.min_price !== undefined) data.minPrice = input.min_price
  if (input.description_template !== undefined)
    data.descriptionTemplate = input.description_template
  if (input.sort_order !== undefined) data.sortOrder = input.sort_order

  const updated = await prisma.serviceCatalog.update({
    where: { id: serviceId },
    data,
  })

  return formatFull(updated)
}

export async function deactivateService(user: AuthUser, serviceId: string) {
  if (!isOwnerRole(user.role)) {
    return { error: 'FORBIDDEN' as const }
  }

  const service = await prisma.serviceCatalog.findFirst({
    where: { id: serviceId, tenantId: user.tenant_id },
  })
  if (!service) return { error: 'NOT_FOUND' as const }

  if (!service.isActive) {
    return { error: 'ALREADY_INACTIVE' as const }
  }

  await prisma.serviceCatalog.update({
    where: { id: serviceId },
    data: { isActive: false },
  })

  return { id: service.id, name: service.name, is_active: false }
}

export async function reactivateService(user: AuthUser, serviceId: string) {
  if (!isOwnerRole(user.role)) {
    return { error: 'FORBIDDEN' as const }
  }

  const service = await prisma.serviceCatalog.findFirst({
    where: { id: serviceId, tenantId: user.tenant_id },
  })
  if (!service) return { error: 'NOT_FOUND' as const }

  if (service.isActive) {
    return { error: 'ALREADY_ACTIVE' as const }
  }

  await prisma.serviceCatalog.update({
    where: { id: serviceId },
    data: { isActive: true },
  })

  return { id: service.id, name: service.name, is_active: true }
}
