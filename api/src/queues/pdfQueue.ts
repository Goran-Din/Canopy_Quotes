import Bull from 'bull';
import { PdfJobData } from '../types/pdf.types.js';

export const pdfQueue = new Bull<PdfJobData>('pdf-generation', {
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379'),
    password: process.env.REDIS_PASSWORD,
  },
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

// Log queue-level errors (not job-level)
pdfQueue.on('error', (err) => {
  console.error('[PdfQueue] Queue error:', err);
});
