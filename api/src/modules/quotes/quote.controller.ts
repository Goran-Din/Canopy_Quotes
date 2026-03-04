import type { Request, Response } from 'express'
import {
  CreateQuoteSchema,
  UpdateQuoteSchema,
  UpdateLineItemsSchema,
  AddLineItemSchema,
  UpdateSingleLineItemSchema,
  UpdateQuoteStatusSchema,
  ListQuotesQuerySchema,
  QuoteStatsQuerySchema,
} from './quote.schema.js'
import * as quoteService from './quote.service.js'

// ── Quote CRUD ───────────────────────────────────────────────────────

export async function createQuote(req: Request, res: Response) {
  const parsed = CreateQuoteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const result = await quoteService.createQuote(req.user!, parsed.data)

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Coordinators cannot create quotes',
      })
      return
    }
    if (result.error === 'CUSTOMER_NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Customer not found',
      })
      return
    }
    if (result.error === 'PROPERTY_NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Property not found for this customer',
      })
      return
    }
  }

  res.status(201).json(result)
}

export async function listQuotes(req: Request, res: Response) {
  const parsed = ListQuotesQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Invalid query parameters',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const result = await quoteService.listQuotes(req.user!, parsed.data)
  res.json(result)
}

export async function getQuote(req: Request, res: Response) {
  const quoteId = req.params.id as string
  const result = await quoteService.getQuoteById(req.user!, quoteId)

  if ('error' in result) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Quote not found',
    })
    return
  }

  res.json(result)
}

export async function updateQuote(req: Request, res: Response) {
  const parsed = UpdateQuoteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const quoteId = req.params.id as string
  const result = await quoteService.updateQuote(req.user!, quoteId, parsed.data)

  if ('error' in result) {
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Quote not found',
      })
      return
    }
    if (result.error === 'NOT_DRAFT') {
      res.status(409).json({
        error: 'CONFLICT',
        message:
          'Only draft quotes can be edited. Use duplicate to create a revised version.',
      })
      return
    }
    if (result.error === 'DISCOUNT_EXCEEDED') {
      res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: result.message,
      })
      return
    }
  }

  res.json(result)
}

export async function deleteQuote(req: Request, res: Response) {
  const quoteId = req.params.id as string
  const result = await quoteService.deleteQuote(req.user!, quoteId)

  if ('error' in result) {
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Quote not found',
      })
      return
    }
    if (result.error === 'NOT_DRAFT') {
      res.status(409).json({
        error: 'CONFLICT',
        message: 'Only draft quotes can be deleted.',
      })
      return
    }
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions to delete this quote',
      })
      return
    }
  }

  res.json(result)
}

// ── Line Items ───────────────────────────────────────────────────────

export async function batchUpdateLineItems(req: Request, res: Response) {
  const parsed = UpdateLineItemsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const quoteId = req.params.id as string
  const result = await quoteService.updateLineItems(
    req.user!,
    quoteId,
    parsed.data,
  )

  if ('error' in result) {
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Quote not found',
      })
      return
    }
    if (result.error === 'NOT_DRAFT') {
      res.status(409).json({
        error: 'CONFLICT',
        message: 'Only draft quotes can be edited.',
      })
      return
    }
    if (result.error === 'DISCOUNT_EXCEEDED') {
      res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: result.message,
      })
      return
    }
  }

  res.json(result)
}

export async function addLineItem(req: Request, res: Response) {
  const parsed = AddLineItemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const quoteId = req.params.id as string
  const result = await quoteService.addLineItem(req.user!, quoteId, parsed.data)

  if ('error' in result) {
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Quote not found',
      })
      return
    }
    if (result.error === 'NOT_DRAFT') {
      res.status(409).json({
        error: 'CONFLICT',
        message: 'Only draft quotes can be edited.',
      })
      return
    }
  }

  res.status(201).json(result)
}

export async function updateSingleLineItem(req: Request, res: Response) {
  const parsed = UpdateSingleLineItemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const quoteId = req.params.id as string
  const lineItemId = req.params.lineItemId as string
  const result = await quoteService.updateSingleLineItem(
    req.user!,
    quoteId,
    lineItemId,
    parsed.data,
  )

  if ('error' in result) {
    if (result.error === 'QUOTE_NOT_FOUND' || result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message:
          result.error === 'QUOTE_NOT_FOUND'
            ? 'Quote not found'
            : 'Line item not found',
      })
      return
    }
    if (result.error === 'NOT_DRAFT') {
      res.status(409).json({
        error: 'CONFLICT',
        message: 'Only draft quotes can be edited.',
      })
      return
    }
  }

  res.json(result)
}

export async function deleteLineItem(req: Request, res: Response) {
  const quoteId = req.params.id as string
  const lineItemId = req.params.lineItemId as string
  const result = await quoteService.deleteLineItem(
    req.user!,
    quoteId,
    lineItemId,
  )

  if ('error' in result) {
    if (result.error === 'QUOTE_NOT_FOUND' || result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message:
          result.error === 'QUOTE_NOT_FOUND'
            ? 'Quote not found'
            : 'Line item not found',
      })
      return
    }
    if (result.error === 'NOT_DRAFT') {
      res.status(409).json({
        error: 'CONFLICT',
        message: 'Only draft quotes can be edited.',
      })
      return
    }
  }

  res.json(result)
}

// ── Status Transitions ───────────────────────────────────────────────

export async function updateQuoteStatus(req: Request, res: Response) {
  const parsed = UpdateQuoteStatusSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      fields: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const quoteId = req.params.id as string
  const result = await quoteService.updateQuoteStatus(
    req.user!,
    quoteId,
    parsed.data,
  )

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only Owner or Division Manager can approve/reject quotes',
      })
      return
    }
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Quote not found',
      })
      return
    }
    if (result.error === 'INVALID_TRANSITION') {
      res.status(409).json({
        error: 'CONFLICT',
        message: result.message,
      })
      return
    }
  }

  res.json(result)
}

// ── Duplicate ────────────────────────────────────────────────────────

export async function duplicateQuote(req: Request, res: Response) {
  const quoteId = req.params.id as string
  const result = await quoteService.duplicateQuote(req.user!, quoteId)

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Coordinators cannot create quotes',
      })
      return
    }
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Quote not found',
      })
      return
    }
  }

  res.status(201).json(result)
}

// ── Stats ────────────────────────────────────────────────────────────

export async function getQuoteStats(req: Request, res: Response) {
  const parsed = QuoteStatsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Invalid query parameters',
    })
    return
  }

  const result = await quoteService.getQuoteStats(req.user!, parsed.data.month)
  res.json(result)
}
