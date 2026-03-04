import { Request, Response } from 'express';
import { ServiceCatalogService } from '../../services/ServiceCatalogService.js';
import { PricingEngine } from '../../services/PricingEngine.js';
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  CalculatePriceSchema,
  ListServicesQuerySchema,
  CreatePricingRuleSchema,
  UpdatePricingRuleSchema,
} from './service.schema.js';
import { ServiceCategory } from '../../types/serviceCatalog.js';

export class ServiceController {
  constructor(
    private catalogService: ServiceCatalogService,
    private pricingEngine: PricingEngine
  ) {}

  /**
   * GET /v1/services
   * List active services for Quote Builder Step 3 (salesperson view).
   * Also supports ?active=false for Owner to see all services.
   */
  listServices = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = ListServicesQuerySchema.parse(req.query);
      const tenantId: string = req.user!.tenant_id;
      const callerRole = req.user!.role;
      const category = query.category as ServiceCategory | undefined;

      // Owner requesting all services (active + inactive)
      const showAll = query.active === 'false' && ['owner', 'n37_super_admin'].includes(callerRole);

      if (showAll) {
        const services = await this.catalogService.getAllServicesForOwner(tenantId, callerRole);
        res.status(200).json({ services });
      } else {
        const services = await this.catalogService.getActiveServices(tenantId, category);
        res.status(200).json({ services });
      }
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * GET /v1/services/:id
   * Get single service with pricing formula (Owner only).
   */
  getService = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const callerRole = req.user!.role;
      const service = await this.catalogService.getServiceWithFormula(
        tenantId,
        req.params.id as string,
        callerRole
      );
      res.status(200).json(service);
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * POST /v1/services
   * Create a new service (Owner only).
   */
  createService = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const callerRole = req.user!.role;
      const data = CreateServiceSchema.parse(req.body);
      const service = await this.catalogService.createService(tenantId, callerRole, data);
      res.status(201).json(service);
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * PUT /v1/services/:id
   * Update an existing service (Owner only).
   */
  updateService = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const callerRole = req.user!.role;
      const data = UpdateServiceSchema.parse(req.body);
      const service = await this.catalogService.updateService(
        tenantId,
        req.params.id as string,
        callerRole,
        data
      );
      res.status(200).json(service);
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * DELETE /v1/services/:id
   * Hard delete NOT allowed — returns 405.
   */
  deleteNotAllowed = (_req: Request, res: Response): void => {
    res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Services cannot be deleted. Use /deactivate to remove a service from the catalog.',
    });
  };

  /**
   * PUT /v1/services/:id/deactivate
   * Deactivate a service (Owner only).
   */
  deactivateService = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const callerRole = req.user!.role;
      const service = await this.catalogService.deactivateService(
        tenantId,
        req.params.id as string,
        callerRole
      );
      res.status(200).json({ id: service.id, name: service.name, is_active: service.is_active });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * PUT /v1/services/:id/reactivate
   * Reactivate a previously deactivated service (Owner only).
   */
  reactivateService = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const callerRole = req.user!.role;
      const service = await this.catalogService.reactivateService(
        tenantId,
        req.params.id as string,
        callerRole
      );
      res.status(200).json({ id: service.id, name: service.name, is_active: service.is_active });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * POST /v1/services/:id/calculate-price
   * Live price calculation for Quote Builder Step 4.
   * Called debounced (500ms) as salesperson types measurement.
   */
  calculatePrice = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const { measurement, measurement_unit } = CalculatePriceSchema.parse(req.body);

      const result = await this.pricingEngine.calculate(
        tenantId,
        req.params.id as string,
        measurement,
        measurement_unit
      );
      res.status(200).json(result);
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  // ── Pricing Rules endpoints (Owner only) ──────────────────────────────────

  /**
   * GET /v1/pricing-rules
   */
  listPricingRules = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const callerRole = req.user!.role;
      const rules = await this.catalogService.getPricingRules(tenantId, callerRole);
      res.status(200).json({ rules });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * POST /v1/pricing-rules
   */
  createPricingRule = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const callerRole = req.user!.role;
      const data = CreatePricingRuleSchema.parse(req.body);
      const rule = await this.catalogService.createPricingRule(tenantId, callerRole, data);
      res.status(201).json(rule);
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * PUT /v1/pricing-rules/:id
   */
  updatePricingRule = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const callerRole = req.user!.role;
      const data = UpdatePricingRuleSchema.parse(req.body);
      const rule = await this.catalogService.updatePricingRule(
        tenantId,
        req.params.id as string,
        callerRole,
        data
      );
      res.status(200).json(rule);
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * DELETE /v1/pricing-rules/:id
   */
  deletePricingRule = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const callerRole = req.user!.role;
      await this.catalogService.deletePricingRule(tenantId, req.params.id as string, callerRole);
      res.status(204).send();
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  // ── Shared error handler ──────────────────────────────────────────────────

  private handleError(res: Response, err: any): void {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    switch (err.name) {
      case 'ForbiddenError':
        res.status(403).json({ error: 'FORBIDDEN', message: err.message });
        break;
      case 'NotFoundError':
        res.status(404).json({ error: 'NOT_FOUND', message: err.message });
        break;
      case 'ConflictError':
        res.status(409).json({ error: 'CONFLICT', message: err.message });
        break;
      case 'ValidationError':
        res.status(422).json({ error: 'VALIDATION_ERROR', message: err.message });
        break;
      case 'BusinessError':
        res.status(409).json({ error: 'SERVICE_INACTIVE', message: err.message });
        break;
      case 'PricingEngineError':
        res.status(500).json({ error: 'PRICING_ENGINE_ERROR', message: err.message });
        break;
      default:
        console.error('[ServiceController] Unexpected error:', err);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
    }
  }
}
