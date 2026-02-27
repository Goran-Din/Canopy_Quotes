import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import type { AuthUser } from '../../middleware/authenticate.js'
import type {
  CreatePricingRuleInput,
  UpdatePricingRuleInput,
} from './service-catalog.schema.js'

// ── Helpers ──────────────────────────────────────────────────────────

type RuleRow = Awaited<ReturnType<typeof prisma.pricingRule.findFirst>> & object

function formatRule(r: RuleRow) {
  return {
    id: r.id,
    name: r.name,
    rule_type: r.ruleType,
    adjustment_value: Number(r.adjustmentValue),
    applies_to: r.appliesTo,
    is_active: r.isActive,
    valid_from: r.validFrom,
    valid_until: r.validUntil,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }
}

function isOwnerRole(role: string): boolean {
  return role === 'owner' || role === 'n37_super_admin'
}

// ── CRUD ─────────────────────────────────────────────────────────────

export async function listPricingRules(user: AuthUser) {
  if (!isOwnerRole(user.role)) {
    return { error: 'FORBIDDEN' as const }
  }

  const rules = await prisma.pricingRule.findMany({
    where: { tenantId: user.tenant_id },
    orderBy: { createdAt: 'asc' },
  })

  return { rules: rules.map(formatRule) }
}

export async function createPricingRule(
  user: AuthUser,
  input: CreatePricingRuleInput,
) {
  if (!isOwnerRole(user.role)) {
    return { error: 'FORBIDDEN' as const }
  }

  const rule = await prisma.pricingRule.create({
    data: {
      tenantId: user.tenant_id,
      name: input.name,
      ruleType: input.rule_type,
      adjustmentValue: input.adjustment_value,
      appliesTo: input.applies_to as unknown as Prisma.JsonObject,
      isActive: input.is_active,
      validFrom: input.valid_from ? new Date(input.valid_from) : null,
      validUntil: input.valid_until ? new Date(input.valid_until) : null,
    },
  })

  return formatRule(rule)
}

export async function updatePricingRule(
  user: AuthUser,
  ruleId: string,
  input: UpdatePricingRuleInput,
) {
  if (!isOwnerRole(user.role)) {
    return { error: 'FORBIDDEN' as const }
  }

  const existing = await prisma.pricingRule.findFirst({
    where: { id: ruleId, tenantId: user.tenant_id },
  })
  if (!existing) return { error: 'NOT_FOUND' as const }

  const data: Prisma.PricingRuleUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.rule_type !== undefined) data.ruleType = input.rule_type
  if (input.adjustment_value !== undefined)
    data.adjustmentValue = input.adjustment_value
  if (input.applies_to !== undefined)
    data.appliesTo = input.applies_to as unknown as Prisma.JsonObject
  if (input.is_active !== undefined) data.isActive = input.is_active
  if (input.valid_from !== undefined)
    data.validFrom = input.valid_from ? new Date(input.valid_from) : null
  if (input.valid_until !== undefined)
    data.validUntil = input.valid_until ? new Date(input.valid_until) : null

  const updated = await prisma.pricingRule.update({
    where: { id: ruleId },
    data,
  })

  return formatRule(updated)
}

export async function deletePricingRule(user: AuthUser, ruleId: string) {
  if (!isOwnerRole(user.role)) {
    return { error: 'FORBIDDEN' as const }
  }

  const existing = await prisma.pricingRule.findFirst({
    where: { id: ruleId, tenantId: user.tenant_id },
  })
  if (!existing) return { error: 'NOT_FOUND' as const }

  await prisma.pricingRule.delete({ where: { id: ruleId } })

  return { message: 'Pricing rule deleted.' }
}
