import { Router } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import { ServiceCatalogRepository } from '../../repositories/ServiceCatalogRepository.js';
import { ServiceCatalogService } from '../../services/ServiceCatalogService.js';
import { PricingEngine } from '../../services/PricingEngine.js';
import { ServiceController } from './service.controller.js';

export function createServiceRoutes(db: Pool): Router {
  const router = Router();

  // Wire up dependencies
  const catalogRepo = new ServiceCatalogRepository(db);
  const catalogService = new ServiceCatalogService(catalogRepo);
  const pricingEngine = new PricingEngine(catalogRepo);
  const controller = new ServiceController(catalogService, pricingEngine);

  // All service routes require JWT authentication
  router.use(authenticate);

  // ── Service catalog CRUD ──────────────────────────────────────────────────
  router.get('/',            controller.listServices);        // GET  /v1/services
  router.post('/',           controller.createService);       // POST /v1/services  (owner)
  router.get('/:id',         controller.getService);          // GET  /v1/services/:id  (owner)
  router.put('/:id',         controller.updateService);       // PUT  /v1/services/:id  (owner)
  router.delete('/:id',      controller.deleteNotAllowed);    // DELETE — always 405

  // ── Activate / Deactivate ─────────────────────────────────────────────────
  router.put('/:id/deactivate',  controller.deactivateService);  // owner
  router.put('/:id/reactivate',  controller.reactivateService);  // owner

  // ── Live price calculation ────────────────────────────────────────────────
  router.post('/:id/calculate-price', controller.calculatePrice); // any authenticated user

  return router;
}

export function createPricingRuleRoutes(db: Pool): Router {
  const router = Router();

  const catalogRepo = new ServiceCatalogRepository(db);
  const catalogService = new ServiceCatalogService(catalogRepo);
  const pricingEngine = new PricingEngine(catalogRepo);
  const controller = new ServiceController(catalogService, pricingEngine);

  router.use(authenticate);

  // ── Pricing rules (all owner-only) ────────────────────────────────────────
  router.get('/',     controller.listPricingRules);    // GET  /v1/pricing-rules
  router.post('/',    controller.createPricingRule);   // POST /v1/pricing-rules
  router.put('/:id',  controller.updatePricingRule);   // PUT  /v1/pricing-rules/:id
  router.delete('/:id', controller.deletePricingRule); // DELETE /v1/pricing-rules/:id

  return router;
}
