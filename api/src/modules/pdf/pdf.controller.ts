import { Request, Response } from 'express';
import { createClient } from 'redis';
import { randomUUID } from 'crypto';
import { pdfQueue } from '../../queues/pdfQueue.js';
import { PdfService } from '../../services/PdfService.js';
import { PdfJobResult } from '../../types/pdf.types.js';

const IS_LOCAL_DEV = process.env.NODE_ENV === 'development';

export class PdfController {
  constructor(
    private pdfService: PdfService,
    private redis: ReturnType<typeof createClient>
  ) {}

  /**
   * POST /v1/quotes/:id/generate-pdf
   * Production: enqueues Bull job, returns 202 for polling.
   * Local dev: generates synchronously (no worker needed), stores result in Redis.
   */
  generatePdf = async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.id as string;
      const tenantId: string = req.user!.tenant_id;
      const userId: string = req.user!.sub;

      const jobId = randomUUID();

      if (IS_LOCAL_DEV) {
        // Dev mode: process synchronously — no Bull worker needed
        res.status(202).json({
          message: 'PDF generation started',
          job_id: jobId,
          poll_url: `/v1/quotes/${quoteId}/pdf-status/${jobId}`,
        });

        // Generate in background (don't block the response)
        this.processLocally(tenantId, quoteId, userId, jobId).catch((err) => {
          console.error('[PdfController] Local PDF generation failed:', err);
        });
        return;
      }

      await pdfQueue.add({
        tenantId,
        quoteId,
        generatedBy: userId,
        jobId,
      });

      res.status(202).json({
        message: 'PDF generation started',
        job_id: jobId,
        poll_url: `/v1/quotes/${quoteId}/pdf-status/${jobId}`,
      });
    } catch (err: any) {
      console.error('[PdfController] generatePdf error:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to enqueue PDF generation' });
    }
  };

  /**
   * Dev-only: generates the PDF synchronously and writes result to Redis.
   */
  private async processLocally(
    tenantId: string,
    quoteId: string,
    userId: string,
    jobId: string
  ): Promise<void> {
    try {
      console.log(`[PdfController] Dev mode — generating PDF for quote ${quoteId}`);
      const proposal = await this.pdfService.generateProposal(tenantId, quoteId, userId);
      const signedUrl = await this.pdfService.getCurrentProposalUrl(tenantId, quoteId);

      await this.redis.setEx(
        `pdf-job:${jobId}`,
        600,
        JSON.stringify({ status: 'done', proposal_id: proposal.id, signed_url: signedUrl.signed_url })
      );
      console.log(`[PdfController] Dev mode — PDF ready for quote ${quoteId}`);
    } catch (error) {
      const message = (error as Error).message;
      console.error(`[PdfController] Dev mode — PDF failed:`, error);
      await this.redis.setEx(
        `pdf-job:${jobId}`,
        600,
        JSON.stringify({ status: 'failed', error: message })
      );
    }
  }

  /**
   * GET /v1/quotes/:id/pdf-status/:jobId
   * Frontend polls this every 2 seconds while showing spinner.
   * Reads from Redis — responds with pending / done / failed.
   */
  getPdfStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      const cached = await this.redis.get(`pdf-job:${jobId}`);

      if (!cached) {
        res.status(200).json({ status: 'pending' } satisfies PdfJobResult);
        return;
      }

      const result = JSON.parse(cached) as PdfJobResult;
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[PdfController] getPdfStatus error:', err);
      res.status(200).json({ status: 'pending' }); // Fail safe — keep frontend polling
    }
  };

  /**
   * GET /v1/quotes/:id/pdf-url
   * Returns a fresh signed URL for the current proposal PDF.
   * Call this whenever the frontend needs to display or download the PDF.
   */
  getPdfUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const quoteId = req.params.id as string;
      const tenantId: string = req.user!.tenant_id;

      const { proposal, signed_url, expires_at } =
        await this.pdfService.getCurrentProposalUrl(tenantId, quoteId);

      res.status(200).json({
        proposal_id: proposal.id,
        version: proposal.version,
        signed_url,
        expires_at,
      });
    } catch (err: any) {
      if (err.message?.includes('No proposal')) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'No proposal PDF generated for this quote yet' });
        return;
      }
      console.error('[PdfController] getPdfUrl error:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to generate signed URL' });
    }
  };
}
