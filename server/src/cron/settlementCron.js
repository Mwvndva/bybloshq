import cron from 'node-cron';
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import settlementService from '../services/settlement.service.js';

const LOCK_KEY = 'byblos:settlement-promotion';

export async function promoteSettlementsOnce({ limit = 100 } = {}) {
    const client = await pool.connect();
    try {
        const { rows: [lockRow] } = await client.query(
            'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
            [LOCK_KEY]
        );

        if (!lockRow?.locked) {
            logger.info('[SettlementCron] Settlement promotion already running; skipping');
            return { skipped: true, reason: 'lock_not_acquired' };
        }

        await client.query('BEGIN');
        const result = await settlementService.promoteEligibleSettlements(client, { limit });
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        logger.error('[SettlementCron] Settlement promotion failed:', error.message);
        throw error;
    } finally {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]).catch(() => {});
        client.release();
    }
}

export function scheduleSettlementPromotion({ schedule = process.env.SETTLEMENT_PROMOTION_CRON || '*/30 * * * *', limit = 100 } = {}) {
    return cron.schedule(schedule, () => {
        promoteSettlementsOnce({ limit }).catch(error => {
            logger.error('[SettlementCron] Scheduled promotion failed:', error.message);
        });
    });
}
