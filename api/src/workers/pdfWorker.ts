/**
 * PDF Worker Process
 * Runs as a separate process from the HTTP API server.
 * Started via: node dist/workers/pdfWorker.js
 * Docker Compose starts this as the canopy-quotes-worker container.
 */
import { createClient } from 'redis';
import { Pool } from 'pg';
import { pdfQueue } from '../queues/pdfQueue.js';
import { PdfService } from '../services/PdfService.js';
import { ProposalRepository } from '../repositories/ProposalRepository.js';
import { createR2Client } from '../config/r2Client.js';
import { PdfJobData } from '../types/pdf.types.js';

// ── Database connection ────────────────────────────────────────────────────────
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // Worker needs fewer connections than the API
});

// ── Redis client (for storing job results for polling) ────────────────────────
const redis = createClient({
  url: `redis://${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? '6379'}`,
  password: process.env.REDIS_PASSWORD,
});

redis.on('error', (err) => console.error('[PdfWorker] Redis client error:', err));

// ── Service wiring ─────────────────────────────────────────────────────────────
const r2Client = createR2Client();
const proposalRepo = new ProposalRepository(db);
const pdfService = new PdfService(proposalRepo, r2Client, db);

// ── Worker concurrency ────────────────────────────────────────────────────────
const concurrency = parseInt(process.env.PDF_WORKER_CONCURRENCY ?? '2');

// ── Start processing ──────────────────────────────────────────────────────────
async function start() {
  await redis.connect();
  console.log(`[PdfWorker] Starting with concurrency=${concurrency}`);

  pdfQueue.process(concurrency, async (job) => {
    const { tenantId, quoteId, generatedBy, jobId } = job.data as PdfJobData;

    console.log(`[PdfWorker] Processing job ${jobId} — quote ${quoteId}`);
    await job.progress(10);

    try {
      const proposal = await pdfService.generateProposal(tenantId, quoteId, generatedBy);
      await job.progress(80);

      const signedUrl = await pdfService.getSignedUrl(tenantId, proposal.id);
      await job.progress(100);

      // Store result in Redis for frontend polling (key expires in 10 minutes)
      await redis.setEx(
        `pdf-job:${jobId}`,
        600,
        JSON.stringify({ status: 'done', proposal_id: proposal.id, signed_url: signedUrl })
      );

      console.log(`[PdfWorker] Job ${jobId} complete — proposal ${proposal.id}`);
      return { proposal_id: proposal.id, signed_url: signedUrl };

    } catch (error) {
      const message = (error as Error).message;
      console.error(`[PdfWorker] Job ${jobId} failed:`, error);

      // Store failure in Redis for frontend polling
      await redis.setEx(
        `pdf-job:${jobId}`,
        600,
        JSON.stringify({ status: 'failed', error: message })
      );

      throw error; // Re-throw so Bull records the failure and retries
    }
  });

  // ── Queue event logging ───────────────────────────────────────────────────
  pdfQueue.on('completed', (job) => {
    console.log(`[PdfWorker] Job ${job.id} completed successfully`);
  });

  pdfQueue.on('failed', (job, err) => {
    console.error(`[PdfWorker] Job ${job.id} failed after ${job.opts.attempts} attempts:`, err.message);
  });

  pdfQueue.on('stalled', (job) => {
    console.warn(`[PdfWorker] Job ${job.id} stalled — will be re-queued`);
  });

  console.log('[PdfWorker] Ready and listening for jobs');
}

start().catch((err) => {
  console.error('[PdfWorker] Fatal startup error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[PdfWorker] SIGTERM received — shutting down gracefully');
  await pdfQueue.close();
  await redis.quit();
  await db.end();
  process.exit(0);
});
