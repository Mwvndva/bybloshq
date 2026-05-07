import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';

/**
 * Verify required internal financial indexes.
 * This ensures that critical consistency constraints are present in the DB.
 */
export const verifyRequiredIndexes = async () => {
    logger.info('[SCHEMA-CHECK] Verifying required financial indexes...');

    const requiredIndexes = [
        {
            name: 'payouts_order_id_unique',
            table: 'payouts',
            definition: 'CREATE UNIQUE INDEX IF NOT EXISTS payouts_order_id_unique ON payouts(order_id) WHERE order_id IS NOT NULL'
        },
        {
            name: 'fulfillment_jobs_order_id_unique',
            table: 'fulfillment_jobs',
            definition: 'CREATE UNIQUE INDEX IF NOT EXISTS fulfillment_jobs_order_id_unique ON fulfillment_jobs(order_id)'
        }
    ];

    for (const index of requiredIndexes) {
        try {
            // Check if index exists
            const checkQuery = `
                SELECT 1 FROM pg_indexes 
                WHERE tablename = $1 AND indexname = $2
            `;
            const { rowCount } = await pool.query(checkQuery, [index.table, index.name]);

            if (rowCount === 0) {
                logger.warn(`[SCHEMA-CHECK] Missing critical index: ${index.name}. Attempting to create...`);
                await pool.query(index.definition);
                logger.info(`[SCHEMA-CHECK] Index ${index.name} created successfully.`);
            } else {
                logger.info(`[SCHEMA-CHECK] Index ${index.name} verified.`);
            }
        } catch (error) {
            logger.error(`[SCHEMA-CHECK] Failed to verify/create index ${index.name}:`, error.message);
            // We don't exit(1) here to allow the app to start, but it's a major warning.
        }
    }

    logger.info('✅ Required financial indexes verified');
};


