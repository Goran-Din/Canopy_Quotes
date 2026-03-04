import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';

// ── Schemas ───────────────────────────────────────────────────────────────────
const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  contact_name: z.string().optional(),
  billing_email: z.string().email().optional(),
  phone: z.string().optional(),
  billing_address: AddressSchema.optional(),
});

const UpdateCustomerSchema = CreateCustomerSchema.partial();

const CreatePropertySchema = z.object({
  name: z.string().min(1),
  address: AddressSchema.optional(),
  notes: z.string().optional(),
});

const UpdatePropertySchema = CreatePropertySchema.partial();

// ── Customer routes ───────────────────────────────────────────────────────────
export function createCustomerRoutes(db: Pool): Router {
  const router = Router();
  router.use(authenticate);

  // GET /v1/customers — search / list
  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const search = req.query.search as string | undefined;

      const params: unknown[] = [tenantId];
      let whereClause = 'WHERE tenant_id = $1';

      if (search && search.length >= 2) {
        params.push(`%${search}%`);
        whereClause += ` AND (name ILIKE $${params.length} OR billing_email ILIKE $${params.length} OR contact_name ILIKE $${params.length})`;
      }

      const result = await db.query(
        `SELECT id, name, contact_name, billing_email, phone, billing_address, created_at
         FROM customers ${whereClause}
         ORDER BY name ASC LIMIT 50`,
        params
      );

      res.status(200).json({ customers: result.rows });
    } catch (err) {
      console.error('[CustomerRoutes] GET / error:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  // GET /v1/customers/:id — single customer with properties and quote count
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const customerId = req.params.id as string;

      const customerResult = await db.query(
        `SELECT id, name, contact_name, billing_email, phone, billing_address, created_at
         FROM customers WHERE tenant_id = $1 AND id = $2`,
        [tenantId, customerId]
      );

      if (!customerResult.rows[0]) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found' });
        return;
      }

      const propertiesResult = await db.query(
        `SELECT id, name, address, notes FROM properties
         WHERE tenant_id = $1 AND customer_id = $2 ORDER BY name ASC`,
        [tenantId, customerId]
      );

      const quoteCountResult = await db.query(
        `SELECT COUNT(*) AS total FROM quotes WHERE tenant_id = $1 AND customer_id = $2`,
        [tenantId, customerId]
      );

      res.status(200).json({
        ...customerResult.rows[0],
        properties: propertiesResult.rows,
        quote_count: parseInt(quoteCountResult.rows[0].total),
      });
    } catch (err) {
      console.error('[CustomerRoutes] GET /:id error:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  // POST /v1/customers — create
  router.post('/', async (req: Request, res: Response) => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const body = CreateCustomerSchema.parse(req.body);

      const result = await db.query(
        `INSERT INTO customers (tenant_id, name, contact_name, billing_email, phone, billing_address)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [tenantId, body.name, body.contact_name ?? null, body.billing_email ?? null,
         body.phone ?? null, body.billing_address ? JSON.stringify(body.billing_address) : null]
      );

      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      if (err?.name === 'ZodError') { res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors }); return; }
      console.error('[CustomerRoutes] POST / error:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  // PUT /v1/customers/:id — update
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const customerId = req.params.id as string;
      const body = UpdateCustomerSchema.parse(req.body);

      const fields: string[] = [];
      const params: unknown[] = [tenantId, customerId];

      if (body.name !== undefined) { params.push(body.name); fields.push(`name = $${params.length}`); }
      if (body.contact_name !== undefined) { params.push(body.contact_name); fields.push(`contact_name = $${params.length}`); }
      if (body.billing_email !== undefined) { params.push(body.billing_email); fields.push(`billing_email = $${params.length}`); }
      if (body.phone !== undefined) { params.push(body.phone); fields.push(`phone = $${params.length}`); }
      if (body.billing_address !== undefined) { params.push(JSON.stringify(body.billing_address)); fields.push(`billing_address = $${params.length}`); }

      if (fields.length === 0) { res.status(400).json({ error: 'NO_FIELDS', message: 'No fields to update' }); return; }

      const result = await db.query(
        `UPDATE customers SET ${fields.join(', ')}, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 RETURNING *`,
        params
      );

      if (!result.rows[0]) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
      res.status(200).json(result.rows[0]);
    } catch (err: any) {
      if (err?.name === 'ZodError') { res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors }); return; }
      console.error('[CustomerRoutes] PUT /:id error:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  // GET /v1/customers/:id/quotes — quote history for a customer
  router.get('/:id/quotes', async (req: Request, res: Response) => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const customerId = req.params.id as string;

      const result = await db.query(
        `SELECT q.id, q.quote_number, q.status, q.service_type, q.total_amount,
                q.created_at, q.sent_at, p.name AS property_name,
                u.first_name || ' ' || u.last_name AS salesperson_name
         FROM quotes q
         JOIN properties p ON p.id = q.property_id
         JOIN users u ON u.id = q.created_by
         WHERE q.tenant_id = $1 AND q.customer_id = $2
         ORDER BY q.created_at DESC LIMIT 50`,
        [tenantId, customerId]
      );

      res.status(200).json({ quotes: result.rows });
    } catch (err) {
      console.error('[CustomerRoutes] GET /:id/quotes error:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  // ── Property sub-routes ───────────────────────────────────────────────────

  // POST /v1/customers/:id/properties
  router.post('/:id/properties', async (req: Request, res: Response) => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const customerId = req.params.id as string;
      const body = CreatePropertySchema.parse(req.body);

      const result = await db.query(
        `INSERT INTO properties (tenant_id, customer_id, name, address, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tenantId, customerId, body.name,
         body.address ? JSON.stringify(body.address) : null, body.notes ?? null]
      );

      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      if (err?.name === 'ZodError') { res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors }); return; }
      console.error('[CustomerRoutes] POST /:id/properties error:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  // PUT /v1/customers/:customerId/properties/:propertyId
  router.put('/:customerId/properties/:propertyId', async (req: Request, res: Response) => {
    try {
      const tenantId: string = req.user!.tenant_id;
      const { customerId, propertyId } = req.params;
      const body = UpdatePropertySchema.parse(req.body);

      const fields: string[] = [];
      const params: unknown[] = [tenantId, customerId, propertyId];

      if (body.name !== undefined) { params.push(body.name); fields.push(`name = $${params.length}`); }
      if (body.address !== undefined) { params.push(JSON.stringify(body.address)); fields.push(`address = $${params.length}`); }
      if (body.notes !== undefined) { params.push(body.notes); fields.push(`notes = $${params.length}`); }

      if (fields.length === 0) { res.status(400).json({ error: 'NO_FIELDS' }); return; }

      const result = await db.query(
        `UPDATE properties SET ${fields.join(', ')}, updated_at = NOW()
         WHERE tenant_id = $1 AND customer_id = $2 AND id = $3 RETURNING *`,
        params
      );

      if (!result.rows[0]) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
      res.status(200).json(result.rows[0]);
    } catch (err: any) {
      if (err?.name === 'ZodError') { res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors }); return; }
      console.error('[CustomerRoutes] PUT /:customerId/properties/:propertyId error:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  return router;
}
