import type { Request, Response } from 'express'
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
  ListCustomersQuerySchema,
} from './customer.schema.js'
import * as customerService from './customer.service.js'

export async function listCustomers(req: Request, res: Response) {
  const parsed = ListCustomersQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Invalid query parameters',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const result = await customerService.listCustomers(req.user!, parsed.data)
  res.json(result)
}

export async function getCustomer(req: Request, res: Response) {
  const id = req.params.id as string
  const result = await customerService.getCustomerById(
    req.user!,
    id,
  )

  if (!result) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Customer not found',
    })
    return
  }

  res.json(result)
}

export async function createCustomer(req: Request, res: Response) {
  const parsed = CreateCustomerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const result = await customerService.createCustomer(req.user!, parsed.data)
  res.status(201).json(result)
}

export async function updateCustomer(req: Request, res: Response) {
  const parsed = UpdateCustomerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const id = req.params.id as string
  const result = await customerService.updateCustomer(
    req.user!,
    id,
    parsed.data,
  )

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions to update this customer',
      })
      return
    }
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Customer not found',
    })
    return
  }

  res.json(result)
}
