import type { Request, Response } from 'express'
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  ListServicesQuerySchema,
  CalculatePriceSchema,
  CreatePricingRuleSchema,
  UpdatePricingRuleSchema,
} from './service-catalog.schema.js'
import * as catalogService from './service-catalog.service.js'
import * as pricingEngine from './pricing-engine.js'
import * as pricingRuleService from './pricing-rule.service.js'
import { logger } from '../../config/logger.js'

// ── Service Catalog Endpoints ────────────────────────────────────────

export async function listServices(req: Request, res: Response) {
  const parsed = ListServicesQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Invalid query parameters',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const result = await catalogService.listServices(
    req.user!,
    parsed.data.category,
    parsed.data.active,
  )
  res.json(result)
}

export async function getService(req: Request, res: Response) {
  const serviceId = req.params.id as string
  const result = await catalogService.getServiceById(req.user!, serviceId)

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message:
          'Pricing formula details are only visible to account Owners.',
      })
      return
    }
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Service not found',
    })
    return
  }

  res.json(result)
}

export async function createService(req: Request, res: Response) {
  const parsed = CreateServiceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const result = await catalogService.createService(req.user!, parsed.data)

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only the account Owner can manage the service catalog.',
      })
      return
    }
    if (result.error === 'CONFLICT') {
      res.status(409).json({
        error: 'CONFLICT',
        message: result.message,
      })
      return
    }
    if (result.error === 'VALIDATION_ERROR') {
      res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: result.message,
      })
      return
    }
  }

  res.status(201).json(result)
}

export async function updateService(req: Request, res: Response) {
  const parsed = UpdateServiceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const serviceId = req.params.id as string
  const result = await catalogService.updateService(
    req.user!,
    serviceId,
    parsed.data,
  )

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only the account Owner can manage the service catalog.',
      })
      return
    }
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Service not found',
      })
      return
    }
    if (result.error === 'CONFLICT') {
      res.status(409).json({
        error: 'CONFLICT',
        message: result.message,
      })
      return
    }
    if (result.error === 'VALIDATION_ERROR') {
      res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: result.message,
      })
      return
    }
  }

  res.json(result)
}

export async function deactivateService(req: Request, res: Response) {
  const serviceId = req.params.id as string
  const result = await catalogService.deactivateService(req.user!, serviceId)

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only the account Owner can manage the service catalog.',
      })
      return
    }
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Service not found',
      })
      return
    }
    if (result.error === 'ALREADY_INACTIVE') {
      res.status(409).json({
        error: 'CONFLICT',
        message: 'Service is already inactive.',
      })
      return
    }
  }

  res.json(result)
}

export async function reactivateService(req: Request, res: Response) {
  const serviceId = req.params.id as string
  const result = await catalogService.reactivateService(req.user!, serviceId)

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only the account Owner can manage the service catalog.',
      })
      return
    }
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Service not found',
      })
      return
    }
    if (result.error === 'ALREADY_ACTIVE') {
      res.status(409).json({
        error: 'CONFLICT',
        message: 'Service is already active.',
      })
      return
    }
  }

  res.json(result)
}

export function deleteService(_req: Request, res: Response) {
  res.status(405).json({
    error: 'METHOD_NOT_ALLOWED',
    message:
      'Services cannot be deleted. Use /deactivate to remove a service from the catalog.',
  })
}

// ── Price Calculation Endpoint ───────────────────────────────────────

export async function calculatePrice(req: Request, res: Response) {
  const parsed = CalculatePriceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const serviceId = req.params.id as string

  try {
    const result = await pricingEngine.calculate(
      req.user!.tenant_id,
      serviceId,
      parsed.data.measurement,
    )

    // Handle error returns from pricing engine
    const asAny = result as unknown as Record<string, unknown>
    if (asAny.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Service not found',
      })
      return
    }
    if (asAny.error === 'SERVICE_INACTIVE') {
      res.status(409).json({
        error: 'SERVICE_INACTIVE',
        message: 'This service is no longer available for new quotes',
      })
      return
    }
    if (asAny.error === 'PRICING_ENGINE_ERROR') {
      logger.error('Corrupted pricing formula', { serviceId })
      res.status(500).json({
        error: 'PRICING_ENGINE_ERROR',
        message: 'Unable to evaluate pricing formula. Contact support.',
      })
      return
    }

    res.json(result)
  } catch (err) {
    logger.error('Pricing engine error', { serviceId, error: err })
    res.status(500).json({
      error: 'PRICING_ENGINE_ERROR',
      message: 'Unable to evaluate pricing formula. Contact support.',
    })
  }
}

// ── Pricing Rules Endpoints ──────────────────────────────────────────

export async function listPricingRules(req: Request, res: Response) {
  const result = await pricingRuleService.listPricingRules(req.user!)

  if ('error' in result && result.error === 'FORBIDDEN') {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Insufficient permissions for this action',
    })
    return
  }

  res.json(result)
}

export async function createPricingRule(req: Request, res: Response) {
  const parsed = CreatePricingRuleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const result = await pricingRuleService.createPricingRule(
    req.user!,
    parsed.data,
  )

  if ('error' in result && result.error === 'FORBIDDEN') {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Insufficient permissions for this action',
    })
    return
  }

  res.status(201).json(result)
}

export async function updatePricingRule(req: Request, res: Response) {
  const parsed = UpdatePricingRuleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const ruleId = req.params.id as string
  const result = await pricingRuleService.updatePricingRule(
    req.user!,
    ruleId,
    parsed.data,
  )

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions for this action',
      })
      return
    }
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Pricing rule not found',
      })
      return
    }
  }

  res.json(result)
}

export async function deletePricingRule(req: Request, res: Response) {
  const ruleId = req.params.id as string
  const result = await pricingRuleService.deletePricingRule(req.user!, ruleId)

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions for this action',
      })
      return
    }
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Pricing rule not found',
      })
      return
    }
  }

  res.json(result)
}
