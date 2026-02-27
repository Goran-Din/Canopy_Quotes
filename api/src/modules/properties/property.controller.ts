import type { Request, Response } from 'express'
import {
  CreatePropertySchema,
  UpdatePropertySchema,
} from './property.schema.js'
import * as propertyService from './property.service.js'

export async function listProperties(req: Request, res: Response) {
  const customerId = req.params.customerId as string
  const result = await propertyService.listProperties(req.user!, customerId)

  if ('error' in result) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Customer not found',
    })
    return
  }

  res.json(result)
}

export async function createProperty(req: Request, res: Response) {
  const parsed = CreatePropertySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const customerId = req.params.customerId as string
  const result = await propertyService.createProperty(
    req.user!,
    customerId,
    parsed.data,
  )

  if ('error' in result) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Customer not found',
    })
    return
  }

  res.status(201).json(result)
}

export async function updateProperty(req: Request, res: Response) {
  const parsed = UpdatePropertySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const propertyId = req.params.id as string
  const result = await propertyService.updateProperty(
    req.user!,
    propertyId,
    parsed.data,
  )

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions to update this property',
      })
      return
    }
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Property not found',
    })
    return
  }

  res.json(result)
}
