import { Router } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import { DashboardRepository } from '../../repositories/DashboardRepository.js';
import { DashboardService } from '../../services/DashboardService.js';
import { DashboardController } from './dashboard.controller.js';
import { ProposalRepository } from '../../repositories/ProposalRepository.js';
import { PdfService } from '../../services/PdfService.js';
import { EmailService } from '../../services/EmailService.js';
import { createR2Client } from '../../config/r2Client.js';

/**
 * Creates the quote dashboard & management routes.
 * Mounts on /v1/quotes — alongside the existing quote builder routes.
 *
 * IMPORTANT: The /stats route must be declared BEFORE /:id routes
 * to prevent Express matching 'stats' as an :id param.
 */
export function createDashboardRoutes(db: Pool): Router {
  const router = Router();

  // Wire dependencies
  const r2Client = createR2Client();
  const dashboardRepo = new DashboardRepository(db);
  const proposalRepo = new ProposalRepository(db);
  const pdfService = new PdfService(proposalRepo, r2Client, db);
  const emailService = new EmailService(pdfService, proposalRepo, db);
  const dashboardService = new DashboardService(dashboardRepo, emailService, db);
  const controller = new DashboardController(dashboardService);

  router.use(authenticate);

  // GET /v1/quotes/stats  ← MUST come before /:id routes
  router.get('/stats', controller.getStats);

  // GET  /v1/quotes           — paginated list with filters
  router.get('/', controller.listQuotes);

  // GET  /v1/quotes/:id       — full quote detail
  router.get('/:id', controller.getQuoteDetail);

  // PUT  /v1/quotes/:id/status — approve / reject
  router.put('/:id/status', controller.changeStatus);

  // POST /v1/quotes/:id/duplicate — copy to new draft
  router.post('/:id/duplicate', controller.duplicateQuote);

  // DELETE /v1/quotes/:id — delete draft only
  router.delete('/:id', controller.deleteQuote);

  return router;
}
