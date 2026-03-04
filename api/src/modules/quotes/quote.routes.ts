import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import {
  createQuote,
  listQuotes,
  getQuote,
  updateQuote,
  deleteQuote,
  batchUpdateLineItems,
  addLineItem,
  updateSingleLineItem,
  deleteLineItem,
  updateQuoteStatus,
  duplicateQuote,
  getQuoteStats,
} from './quote.controller.js'

const router = Router()

router.use(authenticate)

// ── Dashboard Stats ──────────────────────────────────────────────────
// Must be before /:id to avoid matching 'stats' as a UUID
router.get('/stats', getQuoteStats)

// ── Quote CRUD ───────────────────────────────────────────────────────
router.get('/', listQuotes)
router.post('/', createQuote)
router.get('/:id', getQuote)
router.put('/:id', updateQuote)
router.delete('/:id', deleteQuote)

// ── Line Items ───────────────────────────────────────────────────────
// Batch update (Step 4 save point — updates all line items + totals)
router.put('/:id/line-items', batchUpdateLineItems)

// Individual line item CRUD
router.post('/:id/line-items', addLineItem)
router.put('/:id/line-items/:lineItemId', updateSingleLineItem)
router.delete('/:id/line-items/:lineItemId', deleteLineItem)

// ── Status Transitions ───────────────────────────────────────────────
router.put(
  '/:id/status',
  requireRole('owner', 'n37_super_admin', 'division_manager'),
  updateQuoteStatus,
)

// ── Duplicate ────────────────────────────────────────────────────────
router.post('/:id/duplicate', duplicateQuote)

export default router
