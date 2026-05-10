import crypto from 'node:crypto';
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';

class WithdrawalRetryWorkerService {
  static async retryPendingApiCalls(withdrawalService) {
    try {
      logger.info('[WithdrawalRetryWorker] Checking for pending API calls to retry...');
      const workerId = `withdrawal-retry-${process.pid}-${Date.now()}-${crypto.randomUUID()}`;
      const claimClient = await pool.connect();
      let pending = [];
      try {
        await claimClient.query('BEGIN');
        const { rows } = await claimClient.query(
          `WITH claimed AS (
             SELECT wr.id
             FROM withdrawal_requests wr
             WHERE wr.status = 'processing'
               AND wr.api_call_pending = TRUE
               AND wr.created_at > NOW() - INTERVAL '7 days'
               AND (
                 wr.retry_started_at IS NULL
                 OR wr.retry_started_at < NOW() - INTERVAL '10 minutes'
               )
             ORDER BY wr.created_at ASC
             LIMIT 25
             FOR UPDATE SKIP LOCKED
           )
           UPDATE withdrawal_requests wr
           SET retry_started_at = NOW(),
               retry_worker_id = $1,
               updated_at = NOW()
           FROM claimed
           WHERE wr.id = claimed.id
           RETURNING wr.*`,
          [workerId]
        );

        if (rows.length) {
          const ids = rows.map(row => row.id);
          const joined = await claimClient.query(
            `SELECT wr.*, s.full_name, s.whatsapp_number
             FROM withdrawal_requests wr
             JOIN sellers s ON wr.seller_id = s.id
             WHERE wr.id = ANY($1::int[])`,
            [ids]
          );
          pending = joined.rows;
        }
        await claimClient.query('COMMIT');
      } catch (claimErr) {
        await claimClient.query('ROLLBACK').catch(() => {});
        throw claimErr;
      } finally {
        claimClient.release();
      }

      if (pending.length === 0) {
        logger.info('[WithdrawalRetryWorker] No pending API calls found.');
        return;
      }

      logger.info(`[WithdrawalRetryWorker] Found ${pending.length} pending requests to retry.`);

      for (let i = 0; i < pending.length; i++) {
        const request = pending[i];
        const entity = {
          id: request.seller_id,
          full_name: request.full_name,
          whatsapp_number: request.whatsapp_number
        };

        await withdrawalService._callProviderAndUpdate(request, entity, Number.parseFloat(request.amount), request.mpesa_number)
          .catch(err => logger.error(`[WithdrawalRetryWorker] Retry failed for request ${request.id}:`, err));

        await pool.query(
          `UPDATE withdrawal_requests
           SET retry_started_at = NULL,
               retry_worker_id = NULL,
               updated_at = NOW()
           WHERE id = $1
             AND retry_worker_id = $2
             AND api_call_pending = TRUE`,
          [request.id, workerId]
        );

        if ((i + 1) % 3 === 0 && (i + 1) < pending.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      logger.error('[WithdrawalRetryWorker] Error during pending API call retry:', error);
    }
  }
}

export default WithdrawalRetryWorkerService;
