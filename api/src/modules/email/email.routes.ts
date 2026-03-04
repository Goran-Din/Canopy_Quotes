import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../../middleware/authenticate.js';
import { ProposalRepository } from '../../repositories/ProposalRepository.js';
import { PdfService } from '../../services/PdfService.js';
import { EmailService } from '../../services/EmailService.js';
import { EmailController } from './email.controller.js';
import { createR2Client } from '../../config/r2Client.js';

/**
 * Creates email-related routes.
 * Mounted on /v1/quotes alongside existing quote and PDF routes.
 */
export function createEmailRoutes(db: Pool): Router {
  const router = Router();

  const r2Client = createR2Client();

  if (!r2Client) {
    router.use(authenticate);
    const unavailable = (_req: Request, res: Response) => {
      res.status(503).json({ error: 'PDF storage not configured' });
    };
    router.post('/:id/send', unavailable);
    router.post('/:id/resend', unavailable);
    return router;
  }

  const proposalRepo = new ProposalRepository(db);
  const pdfService = new PdfService(proposalRepo, r2Client, db);
  const emailService = new EmailService(pdfService, proposalRepo, db);
  const controller = new EmailController(emailService);

  // Inject db onto req for controller use
  router.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).db = db;
    next();
  });

  router.use(authenticate);

  // POST /v1/quotes/:id/send   — first send
  router.post('/:id/send', controller.sendProposal);

  // POST /v1/quotes/:id/resend — re-send existing PDF
  router.post('/:id/resend', controller.resendProposal);

  return router;
}
