import { Router, Request, Response } from 'express';
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
 * If R2 credentials are not configured, routes return 503 instead of crashing.
 */
export function createPdfRoutes(db: Pool, redis: ReturnType<typeof createClient>): Router {
  const router = Router();

  const r2Client = createR2Client();

  if (!r2Client) {
    router.use(authenticate);
    const unavailable = (_req: Request, res: Response) => {
      res.status(503).json({ error: 'PDF storage not configured' });
    };
    router.post('/:id/generate-pdf', unavailable);
    router.get('/:id/pdf-status/:jobId', unavailable);
    router.get('/:id/pdf-url', unavailable);
    return router;
  }

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
