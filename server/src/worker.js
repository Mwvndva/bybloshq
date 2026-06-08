import dotenv from 'dotenv';
import logger from './shared/utils/logger.js';
import { validateEnvironment } from './config/validateEnv.js';
import { testConnection } from './shared/db/database.js';
import servicesLoader from './loaders/services.js';
import cronLoader from './loaders/cron.js';

dotenv.config();

process.env.BYBLOS_PROCESS_ROLE = process.env.BYBLOS_PROCESS_ROLE || 'worker';

async function startWorker() {
    validateEnvironment();

    await import('./events/order.events.js');
    await import('./events/payment.events.js');
    await import('./events/logistics.events.js');
    const { default: eventBus } = await import('./events/eventBus.js');
    await eventBus.verifyRequiredListeners();
    logger.info('[Worker] Event listeners registered');

    await testConnection();
    logger.info('[Worker] Database connected');

    const { verifyRequiredIndexes } = await import('./loaders/schemaCheck.js');
    await verifyRequiredIndexes();

    await servicesLoader();
    await cronLoader();

    const { scheduleFulfillmentRetry } = await import('./cron/paymentCron.js');
    scheduleFulfillmentRetry();
    logger.info('[Worker] Started background services, cron jobs, and fulfillment retry');
}

startWorker().catch(error => {
    logger.error('[Worker] Failed to start:', error);
    process.exit(1);
});

const shutdown = async (signal) => {
    logger.info(`[Worker] ${signal} received. Shutting down gracefully.`);
    try {
        const { pool } = await import('./shared/db/database.js');
        await pool.end();
        logger.info('[Worker] Database pool closed');
    } catch (error) {
        logger.error('[Worker] Error closing pool:', error);
    }
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
    logger.error('[Worker] Unhandled rejection:', error);
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    logger.error('[Worker] Uncaught exception:', error);
    process.exit(1);
});
