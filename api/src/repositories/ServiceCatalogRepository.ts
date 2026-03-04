import { Pool } from 'pg';
import {
  ServiceCatalogPublic,
  ServiceCatalogFull,
  ServiceCategory,
  CreateServiceDto,
  UpdateServiceDto,
} from '../types/serviceCatalog.js';

export class ServiceCatalogRepository {
  constructor(private db: Pool) {}

  // ── Reads ─────────────────────────────────────────────────────────────────

  async findActiveByCategory(
    tenantId: string,
    category?: ServiceCategory
  ): Promise<ServiceCatalogPublic[]> {
    const params: unknown[] = [tenantId];
    let categoryClause = '';
    if (category) {
      params.push(category);
      categoryClause = `AND category = $${params.length}`;
    }

    const result = await this.db.query<ServiceCatalogPublic>(
      `SELECT id, name, category, billing_unit, description_template, sort_order
       FROM service_catalog
       WHERE tenant_id = $1
         AND is_active = TRUE
         ${categoryClause}
       ORDER BY sort_order ASC, name ASC`,
      params
    );
    return result.rows;
  }

  async findAllForOwner(tenantId: string): Promise<ServiceCatalogFull[]> {
    const result = await this.db.query<ServiceCatalogFull>(
      `SELECT id, name, category, billing_unit, base_price_per_unit,
              pricing_formula, min_price, description_template,
              sort_order, is_active, created_at, updated_at
       FROM service_catalog
       WHERE tenant_id = $1
       ORDER BY sort_order ASC, name ASC`,
      [tenantId]
    );
    return result.rows;
  }

  async findById(tenantId: string, serviceId: string): Promise<ServiceCatalogFull | null> {
    const result = await this.db.query<ServiceCatalogFull>(
      `SELECT id, name, category, billing_unit, base_price_per_unit,
              pricing_formula, min_price, description_template,
              sort_order, is_active, created_at, updated_at
       FROM service_catalog
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, serviceId]
    );
    return result.rows[0] ?? null;
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  async create(tenantId: string, data: CreateServiceDto): Promise<ServiceCatalogFull> {
    const result = await this.db.query<ServiceCatalogFull>(
      `INSERT INTO service_catalog
         (tenant_id, name, category, billing_unit, base_price_per_unit,
          pricing_formula, min_price, description_template, sort_order, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW())
       RETURNING *`,
      [
        tenantId,
        data.name,
        data.category,
        data.billing_unit,
        data.base_price_per_unit ?? null,
        JSON.stringify(data.pricing_formula),
        data.min_price ?? null,
        data.description_template ?? null,
        data.sort_order ?? 0,
      ]
    );
    return result.rows[0];
  }

  async update(
    tenantId: string,
    serviceId: string,
    data: UpdateServiceDto
  ): Promise<ServiceCatalogFull | null> {
    const fields: string[] = [];
    const values: unknown[] = [tenantId, serviceId];
    let idx = 3;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.category !== undefined) { fields.push(`category = $${idx++}`); values.push(data.category); }
    if (data.billing_unit !== undefined) { fields.push(`billing_unit = $${idx++}`); values.push(data.billing_unit); }
    if (data.base_price_per_unit !== undefined) { fields.push(`base_price_per_unit = $${idx++}`); values.push(data.base_price_per_unit); }
    if (data.pricing_formula !== undefined) { fields.push(`pricing_formula = $${idx++}`); values.push(JSON.stringify(data.pricing_formula)); }
    if (data.min_price !== undefined) { fields.push(`min_price = $${idx++}`); values.push(data.min_price); }
    if (data.description_template !== undefined) { fields.push(`description_template = $${idx++}`); values.push(data.description_template); }
    if (data.sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(data.sort_order); }

    if (fields.length === 0) return this.findById(tenantId, serviceId);

    const result = await this.db.query<ServiceCatalogFull>(
      `UPDATE service_catalog
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      values
    );
    return result.rows[0] ?? null;
  }

  async setActive(tenantId: string, serviceId: string, isActive: boolean): Promise<void> {
    await this.db.query(
      `UPDATE service_catalog SET is_active = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, serviceId, isActive]
    );
  }

  // ── Pricing rules ─────────────────────────────────────────────────────────

  async findActiveRulesForService(tenantId: string, serviceId: string, category: ServiceCategory) {
    const today = new Date().toISOString().split('T')[0];
    const result = await this.db.query(
      `SELECT * FROM pricing_rules
       WHERE tenant_id = $1
         AND is_active = TRUE
         AND (valid_from IS NULL OR valid_from <= $2)
         AND (valid_until IS NULL OR valid_until >= $2)
       ORDER BY created_at ASC`,
      [tenantId, today]
    );
    // Filter rules that apply to this service/category
    return result.rows.filter((rule: any) => {
      const scope = rule.applies_to;
      if (scope.scope === 'all') return true;
      if (scope.scope === 'category' && scope.category === category) return true;
      if (scope.scope === 'service_ids' && scope.service_ids?.includes(serviceId)) return true;
      return false;
    });
  }

  async findAllRules(tenantId: string) {
    const result = await this.db.query(
      `SELECT * FROM pricing_rules WHERE tenant_id = $1 ORDER BY created_at ASC`,
      [tenantId]
    );
    return result.rows;
  }

  async createRule(tenantId: string, data: any) {
    const result = await this.db.query(
      `INSERT INTO pricing_rules
         (tenant_id, name, rule_type, adjustment_value, applies_to, is_active, valid_from, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        data.name,
        data.rule_type,
        data.adjustment_value,
        JSON.stringify(data.applies_to),
        data.is_active ?? true,
        data.valid_from ?? null,
        data.valid_until ?? null,
      ]
    );
    return result.rows[0];
  }

  async updateRule(tenantId: string, ruleId: string, data: any) {
    const fields: string[] = [];
    const values: unknown[] = [tenantId, ruleId];
    let idx = 3;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.rule_type !== undefined) { fields.push(`rule_type = $${idx++}`); values.push(data.rule_type); }
    if (data.adjustment_value !== undefined) { fields.push(`adjustment_value = $${idx++}`); values.push(data.adjustment_value); }
    if (data.applies_to !== undefined) { fields.push(`applies_to = $${idx++}`); values.push(JSON.stringify(data.applies_to)); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }
    if (data.valid_from !== undefined) { fields.push(`valid_from = $${idx++}`); values.push(data.valid_from); }
    if (data.valid_until !== undefined) { fields.push(`valid_until = $${idx++}`); values.push(data.valid_until); }

    if (fields.length === 0) {
      const r = await this.db.query('SELECT * FROM pricing_rules WHERE tenant_id = $1 AND id = $2', [tenantId, ruleId]);
      return r.rows[0] ?? null;
    }

    const result = await this.db.query(
      `UPDATE pricing_rules SET ${fields.join(', ')}
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      values
    );
    return result.rows[0] ?? null;
  }

  async deleteRule(tenantId: string, ruleId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM pricing_rules WHERE tenant_id = $1 AND id = $2`,
      [tenantId, ruleId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
