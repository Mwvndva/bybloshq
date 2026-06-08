import expressLoader from './express.js';
import cronLoader from './cron.js';
import servicesLoader from './services.js';
import { testConnection } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';

/**
 * Main Loader
 * Orchestrates startup for API and all-in-one process roles.
 *
 * BYBLOS_PROCESS_ROLE:
 * - all/default: API + worker services in one process, preserving current behavior.
 * - api/web: API-only process; cron, outbox replay, WhatsApp boot, and withdrawal retry
 *   workers are expected to run from src/worker.js.
 *
 * @param {import('express').Application} app
 */
export default async (app) => {
    logger.info('Base loaders initializing...');
    const processRole = String(process.env.BYBLOS_PROCESS_ROLE || 'all').toLowerCase();
    const shouldStartWorkers = !['api', 'web'].includes(processRole);

    try {
        await testConnection();
        logger.info('Database connected');

        const { verifyRequiredIndexes } = await import('./schemaCheck.js');
        await verifyRequiredIndexes();
    } catch (err) {
        logger.error('Database connection/verification failed:', err.message);
        process.exit(1);
    }

    await expressLoader(app);
    logger.info('Express loaded');

    if (shouldStartWorkers) {
        await servicesLoader(app);
        logger.info('Services initialized');

        await cronLoader(app);
        logger.info('Cron jobs scheduled');
    } else {
        logger.info('Worker services skipped for API-only process role', { processRole });
    }

    logger.info('All loaders initialized successfully');
};
