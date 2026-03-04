import cron from 'node-cron';
import { Pool } from 'pg';

/**
 * Nightly cron job that marks sent quotes as expired
 * when their valid_until date has passed.
 * Runs at 00:05 UTC every day.
 */
export function scheduleExpireQuotesJob(db: Pool): void {
  cron.schedule('5 0 * * *', async () => {
    console.info('[ExpireQuotesJob] Running quote expiry job');
    try {
      const result = await db.query(
        `UPDATE quotes
         SET status = 'expired', updated_at = NOW()
         WHERE status = 'sent'
           AND valid_until < CURRENT_DATE
         RETURNING id, quote_number, tenant_id`
      );

      const expiredCount = result.rows.length;
      console.info(`[ExpireQuotesJob] ${expiredCount} quotes marked expired`);

      if (expiredCount > 0) {
        console.info('[ExpireQuotesJob] Expired quotes:', result.rows.map((r) => r.quote_number));
      }
    } catch (err) {
      console.error('[ExpireQuotesJob] Job failed:', err);
    }
  });

  console.info('[ExpireQuotesJob] Scheduled — runs nightly at 00:05 UTC');
}
