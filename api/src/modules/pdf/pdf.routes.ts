import { Router } from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { authenticate } from '../../middleware/authenticate.js';
import { ProposalRepository } from '../../repositories/ProposalRepository.js';
import { PdfService } from '../../services/PdfService.js';
import { PdfController } from './pdf.controller.js';
import { createR2Client } from '../../config/r2Client.js';

/**
 * Creates PDF-related routes.
 * These are ADDED to the existing /v1/quotes router (not a separate router).
 *
 * In app.ts, call addPdfRoutes(quotesRouter, db, redis) after creating the quotes router.
 */
export function createPdfRoutes(db: Pool, redis: ReturnType<typeof createClient>): Router {
  const router = Router();

  const r2Client = createR2Client();
  const proposalRepo = new ProposalRepository(db);
  const pdfService = new PdfService(proposalRepo, r2Client, db);
  const controller = new PdfController(pdfService, redis);

  router.use(authenticate);

  // POST /v1/quotes/:id/generate-pdf
  router.post('/:id/generate-pdf', controller.generatePdf);

  // GET  /v1/quotes/:id/pdf-status/:jobId
  router.get('/:id/pdf-status/:jobId', controller.getPdfStatus);

  // GET  /v1/quotes/:id/pdf-url
  router.get('/:id/pdf-url', controller.getPdfUrl);

  return router;
}
