import Bull from 'bull';
import { PdfJobData } from '../types/pdf.types.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const pdfQueue = new Bull<PdfJobData>('pdf-generation', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s → 25s → 125s
    },
    removeOnComplete: 100, // Keep last 100 completed jobs for monitoring
    removeOnFail: 50,      // Keep last 50 failed jobs for debugging
  },
});

// Log queue-level errors but do NOT crash the server
pdfQueue.on('error', (err) => {
  console.error('[PdfQueue] Queue error (non-fatal):', err.message);
});
