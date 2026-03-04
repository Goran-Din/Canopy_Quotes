import { S3Client } from '@aws-sdk/client-s3';

/**
 * Creates a configured S3Client pointed at Cloudflare R2.
 * R2 is S3-compatible. Uses AWS SDK v3.
 * In local dev mode, returns a dummy client (local filesystem is used instead).
 */
export function createR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID ?? '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? '';

  // In development with placeholder creds, return a dummy client
  // (PdfService uses local filesystem instead of R2 in dev mode)
  if (process.env.NODE_ENV === 'development' && (!accountId || accountId === 'placeholder')) {
    console.log('[R2Client] Dev mode — using local filesystem instead of R2');
    return new S3Client({ region: 'auto' });
  }

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.warn('[R2Client] R2 credentials not configured — PDF storage disabled');
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'canopy-quotes';
