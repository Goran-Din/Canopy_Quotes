import { Request, Response } from 'express';
import { z } from 'zod';
import { DashboardService, ForbiddenError, ConflictError, NotFoundError } from '../../services/DashboardService.js';
import { QuoteFilters, UserRole } from '../../types/dashboard.types.js';

// ── Query schemas ─────────────────────────────────────────────────────────────
const ListQuerySchema = z.object({
  status: z.enum(['draft', 'sent', 'approved', 'rejected', 'expired', 'converted']).optional(),
  search: z.string().min(2).optional(),
  service_type: z.string().optional(),
  salesperson_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  sort: z.enum(['created_at', 'updated_at', 'total_amount', 'quote_number']).default('updated_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const StatsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

const ChangeStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().optional(),
});

export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  /**
   * GET /v1/quotes
   * Paginated, filtered, role-scoped quote list.
   */
  listQuotes = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId: string = req.user!.sub;
      const tenantId: string = req.user!.tenant_id;
      const role = req.user!.role as UserRole;
      const filters = ListQuerySchema.parse(req.query) as QuoteFilters;

      const result = await this.dashboardService.listQuotes(tenantId, userId, role, filters);
      res.status(200).json(result);
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * GET /v1/quotes/stats
   * Summary stats for the dashboard header cards.
   */
  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId: string = req.user!.sub;
      const tenantId: string = req.user!.tenant_id;
      const role = req.user!.role as UserRole;
      const { month } = StatsQuerySchema.parse(req.query);

      const stats = await this.dashboardService.getStats(tenantId, userId, role, month);
      res.status(200).json(stats);
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * GET /v1/quotes/:id
   * Full quote detail with line items.
   */
  getQuoteDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.id as string;
      const userId: string = req.user!.sub;
      const tenantId: string = req.user!.tenant_id;
      const role = req.user!.role as UserRole;

      const detail = await this.dashboardService.getQuoteDetail(tenantId, quoteId, userId, role);
      res.status(200).json(detail);
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * PUT /v1/quotes/:id/status
   * Change quote status (approve / reject). Owner and division manager only.
   */
  changeStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.id as string;
      const userId: string = req.user!.sub;
      const tenantId: string = req.user!.tenant_id;
      const role = req.user!.role as UserRole;
      const body = ChangeStatusSchema.parse(req.body);

      await this.dashboardService.changeStatus(tenantId, quoteId, body.status, userId, role);
      res.status(200).json({ message: `Quote ${body.status} successfully` });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * POST /v1/quotes/:id/duplicate
   * Create a new draft quote from an existing quote (copies all line items).
   */
  duplicateQuote = async (req: Request, res: Response): Promise<void> => {
    try {
      const sourceQuoteId = req.params.id as string;
      const userId: string = req.user!.sub;
      const tenantId: string = req.user!.tenant_id;

      const newQuote = await this.dashboardService.duplicateQuote(tenantId, sourceQuoteId, userId);
      res.status(201).json({
        message: 'Quote duplicated successfully',
        quote_id: newQuote.id,
        quote_number: newQuote.quote_number,
      });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * DELETE /v1/quotes/:id
   * Delete a draft quote. Salesperson can only delete their own draft.
   */
  deleteQuote = async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.id as string;
      const userId: string = req.user!.sub;
      const tenantId: string = req.user!.tenant_id;
      const role = req.user!.role as UserRole;

      const quoteNumber = await this.dashboardService.deleteQuote(tenantId, quoteId, userId, role);
      res.status(200).json({ message: `Draft quote ${quoteNumber} deleted.` });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  // ── Error handler ─────────────────────────────────────────────────────────

  private handleError(res: Response, err: any): void {
    if (err?.name === 'ZodError') {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    if (err instanceof ForbiddenError) {
      res.status(403).json({ error: 'FORBIDDEN', message: err.message });
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: 'NOT_FOUND', message: err.message });
      return;
    }
    if (err instanceof ConflictError) {
      res.status(409).json({ error: 'CONFLICT', message: err.message });
      return;
    }
    console.error('[DashboardController] Unexpected error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }
}
