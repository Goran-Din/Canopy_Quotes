import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import {
  listServices,
  getService,
  createService,
  updateService,
  deactivateService,
  reactivateService,
  deleteService,
  calculatePrice,
  listPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
} from './service-catalog.controller.js'

const router = Router()

router.use(authenticate)

// ── Service Catalog ──────────────────────────────────────────────────

// List active services (all authenticated users) / all services (owner)
router.get('/', listServices)

// Get single service with formula (owner only)
router.get('/:id', getService)

// Create new service (owner only)
router.post('/', requireRole('owner', 'n37_super_admin'), createService)

// Update service (owner only)
router.put('/:id', requireRole('owner', 'n37_super_admin'), updateService)

// Deactivate service (owner only)
router.put(
  '/:id/deactivate',
  requireRole('owner', 'n37_super_admin'),
  deactivateService,
)

// Reactivate service (owner only)
router.put(
  '/:id/reactivate',
  requireRole('owner', 'n37_super_admin'),
  reactivateService,
)

// Hard delete blocked — returns 405
router.delete('/:id', deleteService)

// Live price calculation (all authenticated users)
router.post('/:id/calculate-price', calculatePrice)

// ── Pricing Rules ────────────────────────────────────────────────────

const pricingRulesRouter = Router()

pricingRulesRouter.use(authenticate)
pricingRulesRouter.use(requireRole('owner', 'n37_super_admin'))

pricingRulesRouter.get('/', listPricingRules)
pricingRulesRouter.post('/', createPricingRule)
pricingRulesRouter.put('/:id', updatePricingRule)
pricingRulesRouter.delete('/:id', deletePricingRule)

export { router as serviceRoutes, pricingRulesRouter as pricingRuleRoutes }
