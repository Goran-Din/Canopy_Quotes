import { ServiceCatalogRepository } from '../repositories/ServiceCatalogRepository.js';
import {
  ServiceCatalogPublic,
  ServiceCatalogFull,
  ServiceCategory,
  CreateServiceDto,
  UpdateServiceDto,
} from '../types/serviceCatalog.js';

type UserRole = 'n37_super_admin' | 'owner' | 'division_manager' | 'salesperson' | 'coordinator';

// Reuse or import from shared error module
class ForbiddenError extends Error { constructor(msg: string) { super(msg); this.name = 'ForbiddenError'; } }
class NotFoundError extends Error { constructor(msg: string) { super(msg); this.name = 'NotFoundError'; } }
class ConflictError extends Error { constructor(msg: string) { super(msg); this.name = 'ConflictError'; } }

const OWNER_ROLES: UserRole[] = ['owner', 'n37_super_admin'];

function requireOwner(callerRole: UserRole) {
  if (!OWNER_ROLES.includes(callerRole)) {
    throw new ForbiddenError('Only owners can manage the service catalog');
  }
}

export class ServiceCatalogService {
  constructor(private catalogRepo: ServiceCatalogRepository) {}

  // ── Read operations (all authenticated users) ─────────────────────────────

  /**
   * Returns active services for Quote Builder Step 3.
   * NEVER includes pricing_formula.
   */
  async getActiveServices(
    tenantId: string,
    category?: ServiceCategory
  ): Promise<ServiceCatalogPublic[]> {
    return this.catalogRepo.findActiveByCategory(tenantId, category);
  }

  /**
   * Returns full service including pricing_formula.
   * Owner only — throws ForbiddenError for other roles.
   */
  async getServiceWithFormula(
    tenantId: string,
    serviceId: string,
    callerRole: UserRole
  ): Promise<ServiceCatalogFull> {
    requireOwner(callerRole);
    const service = await this.catalogRepo.findById(tenantId, serviceId);
    if (!service) throw new NotFoundError('Service not found');
    return service;
  }

  /**
   * Returns all services (active + inactive) for Owner management screen.
   */
  async getAllServicesForOwner(
    tenantId: string,
    callerRole: UserRole
  ): Promise<ServiceCatalogFull[]> {
    requireOwner(callerRole);
    return this.catalogRepo.findAllForOwner(tenantId);
  }

  // ── Write operations (Owner only) ─────────────────────────────────────────

  async createService(
    tenantId: string,
    callerRole: UserRole,
    data: CreateServiceDto
  ): Promise<ServiceCatalogFull> {
    requireOwner(callerRole);
    return this.catalogRepo.create(tenantId, data);
  }

  async updateService(
    tenantId: string,
    serviceId: string,
    callerRole: UserRole,
    data: UpdateServiceDto
  ): Promise<ServiceCatalogFull> {
    requireOwner(callerRole);
    const existing = await this.catalogRepo.findById(tenantId, serviceId);
    if (!existing) throw new NotFoundError('Service not found');

    const updated = await this.catalogRepo.update(tenantId, serviceId, data);
    return updated!;
  }

  async deactivateService(
    tenantId: string,
    serviceId: string,
    callerRole: UserRole
  ): Promise<ServiceCatalogFull> {
    requireOwner(callerRole);
    const service = await this.catalogRepo.findById(tenantId, serviceId);
    if (!service) throw new NotFoundError('Service not found');
    if (!service.is_active) throw new ConflictError('Service is already inactive');

    await this.catalogRepo.setActive(tenantId, serviceId, false);
    return { ...service, is_active: false };
  }

  async reactivateService(
    tenantId: string,
    serviceId: string,
    callerRole: UserRole
  ): Promise<ServiceCatalogFull> {
    requireOwner(callerRole);
    const service = await this.catalogRepo.findById(tenantId, serviceId);
    if (!service) throw new NotFoundError('Service not found');
    if (service.is_active) throw new ConflictError('Service is already active');

    await this.catalogRepo.setActive(tenantId, serviceId, true);
    return { ...service, is_active: true };
  }

  // ── Pricing rules ─────────────────────────────────────────────────────────

  async getPricingRules(tenantId: string, callerRole: UserRole) {
    requireOwner(callerRole);
    return this.catalogRepo.findAllRules(tenantId);
  }

  async createPricingRule(tenantId: string, callerRole: UserRole, data: any) {
    requireOwner(callerRole);
    return this.catalogRepo.createRule(tenantId, data);
  }

  async updatePricingRule(tenantId: string, ruleId: string, callerRole: UserRole, data: any) {
    requireOwner(callerRole);
    const updated = await this.catalogRepo.updateRule(tenantId, ruleId, data);
    if (!updated) throw new NotFoundError('Pricing rule not found');
    return updated;
  }

  async deletePricingRule(tenantId: string, ruleId: string, callerRole: UserRole) {
    requireOwner(callerRole);
    const deleted = await this.catalogRepo.deleteRule(tenantId, ruleId);
    if (!deleted) throw new NotFoundError('Pricing rule not found');
  }
}
