import { Request, Response } from 'express';
import { z } from 'zod';
import { EmailService, EmailDeliveryError } from '../../services/EmailService.js';

const SendBodySchema = z.object({
  recipient_email: z.string().email().optional(),
  skip_email: z.boolean().optional(),
});

const ResendBodySchema = z.object({
  recipient_email: z.string().email().optional(),
});

export class EmailController {
  constructor(private emailService: EmailService) {}

  /**
   * POST /v1/quotes/:id/send
   * Called from Quote Builder Step 5 — sends proposal PDF to client.
   * Quote must already have a generated PDF (generate-pdf first).
   */
  sendProposal = async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.id as string;
      const tenantId: string = req.user!.tenant_id;
      const body = SendBodySchema.parse(req.body);

      // Load the quote to get customer email
      const quoteResult = await (req as any).db.query(
        `SELECT q.id, q.status, c.billing_email, c.name AS customer_name
         FROM quotes q
         JOIN customers c ON c.id = q.customer_id
         WHERE q.tenant_id = $1 AND q.id = $2`,
        [tenantId, quoteId]
      );

      const quote = quoteResult.rows[0];
      if (!quote) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Quote not found' });
        return;
      }

      // skip_email = true → just mark as sent (used by "Save & Complete" button)
      if (body.skip_email) {
        await (req as any).db.query(
          `UPDATE quotes SET status = 'sent', sent_at = NOW(), updated_at = NOW()
           WHERE tenant_id = $1 AND id = $2 AND status = 'draft'`,
          [tenantId, quoteId]
        );
        res.status(200).json({
          message: 'Quote marked as sent',
          sent_at: new Date().toISOString(),
        });
        return;
      }

      if (!quote.billing_email) {
        res.status(400).json({
          error: 'NO_RECIPIENT_EMAIL',
          message: 'This customer has no billing email. Add an email address to send the proposal.',
        });
        return;
      }

      const result = await this.emailService.sendProposalEmail(
        tenantId,
        quoteId,
        quote.billing_email
      );

      // Mark quote as sent
      await (req as any).db.query(
        `UPDATE quotes SET status = 'sent', sent_at = NOW(), updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND status = 'draft'`,
        [tenantId, quoteId]
      );

      res.status(200).json(result);
    } catch (err: any) {
      this.handleError(res, err, req);
    }
  };

  /**
   * POST /v1/quotes/:id/resend
   * Re-sends existing proposal PDF without regenerating it.
   * Works for quotes in status: sent, approved, expired.
   */
  resendProposal = async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.id as string;
      const tenantId: string = req.user!.tenant_id;
      const body = ResendBodySchema.parse(req.body);

      const quoteResult = await (req as any).db.query(
        `SELECT q.id, q.status, c.billing_email
         FROM quotes q
         JOIN customers c ON c.id = q.customer_id
         WHERE q.tenant_id = $1 AND q.id = $2`,
        [tenantId, quoteId]
      );

      const quote = quoteResult.rows[0];
      if (!quote) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Quote not found' });
        return;
      }

      const resendableStatuses = ['sent', 'approved', 'expired'];
      if (!resendableStatuses.includes(quote.status)) {
        res.status(409).json({
          error: 'INVALID_STATUS',
          message: `Cannot resend a quote with status '${quote.status}'`,
        });
        return;
      }

      const result = await this.emailService.sendProposalEmail(
        tenantId,
        quoteId,
        quote.billing_email,
        body.recipient_email
      );

      // Update sent_at to reflect this resend
      await (req as any).db.query(
        `UPDATE quotes SET sent_at = $3, updated_at = NOW() WHERE tenant_id = $1 AND id = $2`,
        [tenantId, quoteId, result.sent_at]
      );

      res.status(200).json(result);
    } catch (err: any) {
      this.handleError(res, err, req);
    }
  };

  // ── Error handler ─────────────────────────────────────────────────────────

  private handleError(res: Response, err: any, _req: Request): void {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    if (err instanceof EmailDeliveryError) {
      res.status(422).json({
        error: 'EMAIL_DELIVERY_FAILED',
        message: 'The proposal PDF was generated but the email could not be sent.',
        instruction: 'You can try again or download the PDF to send manually.',
      });
      return;
    }
    if (err.message?.includes('No proposal PDF')) {
      res.status(422).json({
        error: 'NO_PDF',
        message: 'No proposal PDF found for this quote. Generate a PDF first.',
      });
      return;
    }
    console.error('[EmailController] Unexpected error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }
}
