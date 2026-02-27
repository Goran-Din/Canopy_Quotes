import { prisma } from '../../config/database.js'
import {
  PricingFormulaSchema,
  type PricingFormula,
} from './service-catalog.schema.js'

export interface PriceCalculation {
  unit_price: number
  line_total: number
  min_price_applied: boolean
  formula_type: PricingFormula['type']
  pricing_rule_applied: boolean
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function evaluateFlatRate(
  measurement: number,
  formula: Extract<PricingFormula, { type: 'flat_rate_sqft' }>,
): { calculatedTotal: number; unitPrice: number } {
  return {
    calculatedTotal: measurement * formula.rate_per_sqft,
    unitPrice: formula.rate_per_sqft,
  }
}

function evaluateTiered(
  measurement: number,
  formula: Extract<PricingFormula, { type: 'tiered_sqft' }>,
): { calculatedTotal: number; unitPrice: number } {
  let total = 0
  let remaining = measurement

  for (const tier of formula.tiers) {
    if (remaining <= 0) break

    const tierCapacity =
      tier.to_sqft === null
        ? remaining
        : Math.min(remaining, tier.to_sqft - tier.from_sqft + 1)

    total += tierCapacity * tier.rate_per_sqft
    remaining -= tierCapacity
  }

  const unitPrice = measurement > 0 ? total / measurement : 0
  return { calculatedTotal: total, unitPrice }
}

function evaluatePerVisit(
  visitCount: number,
  formula: Extract<PricingFormula, { type: 'per_visit' }>,
): { calculatedTotal: number; unitPrice: number } {
  return {
    calculatedTotal: visitCount * formula.price_per_visit,
    unitPrice: formula.price_per_visit,
  }
}

function evaluateProjectFixed(
  enteredPrice: number,
): { calculatedTotal: number; unitPrice: number } {
  return {
    calculatedTotal: enteredPrice,
    unitPrice: enteredPrice,
  }
}

/**
 * Applies active pricing rules to a calculated total.
 * Rules are applied in created_at ASC order and compound.
 */
async function applyPricingRules(
  tenantId: string,
  serviceId: string,
  serviceCategory: string,
  baseTotal: number,
): Promise<number> {
  const now = new Date()

  const rules = await prisma.pricingRule.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [{ validFrom: null }, { validFrom: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
  })

  // Filter rules that haven't expired
  const activeRules = rules.filter(
    (r) => r.validUntil === null || r.validUntil >= now,
  )

  if (activeRules.length === 0) return baseTotal

  let total = baseTotal

  for (const rule of activeRules) {
    const appliesTo = rule.appliesTo as { scope: string; category?: string; service_ids?: string[] }

    // Check if rule applies to this service
    let applies = false
    switch (appliesTo.scope) {
      case 'all':
        applies = true
        break
      case 'category':
        applies = serviceCategory === appliesTo.category
        break
      case 'service_ids':
        applies = appliesTo.service_ids?.includes(serviceId) ?? false
        break
      default:
        applies = false
    }

    if (!applies) continue

    const adjustment = Number(rule.adjustmentValue)
    switch (rule.ruleType) {
      case 'percentage_markup':
        total = total * (1 + adjustment / 100)
        break
      case 'percentage_discount':
        total = total * (1 - adjustment / 100)
        break
      case 'fixed_surcharge':
        total = total + adjustment
        break
      case 'fixed_discount':
        total = Math.max(0, total - adjustment)
        break
    }
  }

  return round(total)
}

/**
 * Calculate the price for a service given a measurement.
 * Pure read-only operation — no database writes.
 */
export async function calculate(
  tenantId: string,
  serviceId: string,
  measurement: number,
): Promise<PriceCalculation> {
  // 1. Load service from catalog (validates tenant scope)
  const service = await prisma.serviceCatalog.findFirst({
    where: { id: serviceId, tenantId },
  })

  if (!service) {
    return { error: 'NOT_FOUND' } as never
  }

  if (!service.isActive) {
    return { error: 'SERVICE_INACTIVE' } as never
  }

  // 2. Parse and validate formula from JSONB
  const formulaResult = PricingFormulaSchema.safeParse(service.pricingFormula)
  if (!formulaResult.success) {
    return { error: 'PRICING_ENGINE_ERROR' } as never
  }
  const formula = formulaResult.data

  // 3. Evaluate formula
  let calculatedTotal: number
  let unitPrice: number

  switch (formula.type) {
    case 'flat_rate_sqft':
      ({ calculatedTotal, unitPrice } = evaluateFlatRate(measurement, formula))
      break
    case 'tiered_sqft':
      ({ calculatedTotal, unitPrice } = evaluateTiered(measurement, formula))
      break
    case 'per_visit':
      ({ calculatedTotal, unitPrice } = evaluatePerVisit(measurement, formula))
      break
    case 'project_fixed':
      ({ calculatedTotal, unitPrice } = evaluateProjectFixed(measurement))
      break
  }

  // 4. Apply minimum price (never applied for project_fixed)
  const minPrice = service.minPrice ? Number(service.minPrice) : null
  const minPriceApplied =
    minPrice !== null &&
    formula.type !== 'project_fixed' &&
    calculatedTotal < minPrice
  const lineTotal = minPriceApplied ? minPrice : calculatedTotal
  if (minPriceApplied && measurement > 0) {
    unitPrice = lineTotal / measurement
  }

  // 5. Apply pricing rules (tenant-level modifiers)
  const adjustedTotal = await applyPricingRules(
    tenantId,
    serviceId,
    service.category,
    lineTotal,
  )

  return {
    unit_price: round(unitPrice),
    line_total: round(adjustedTotal),
    min_price_applied: minPriceApplied,
    formula_type: formula.type,
    pricing_rule_applied: adjustedTotal !== lineTotal,
  }
}
