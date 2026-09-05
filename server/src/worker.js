import dotenv from 'dotenv';
import logger from './shared/utils/logger.js';
import { validateEnvironment } from './shared/config/validateEnv.js';
import { testConnection } from './infrastructure/database/database.js';
import servicesLoader from './application/bootstrap/services.js';
import cronLoader from './application/bootstrap/cron.js';
import { reportError } from './shared/utils/alerting.js';

// Best-effort real-time alert on a fatal crash, then exit — bounded so the
// webhook can never hang the shutdown.
function alertThenExit(err, title) {
    Promise.race([
        reportError(err, { title }),
        new Promise((resolve) => setTimeout(resolve, 2000))
    ]).finally(() => process.exit(1));
}

dotenv.config();

process.env.BYBLOS_PROCESS_ROLE = process.env.BYBLOS_PROCESS_ROLE || 'worker';

async function startWorker() {
    validateEnvironment();

    await import('./application/events/order.events.js');
    await import('./application/events/payment.events.js');
    await import('./application/events/logistics.events.js');
    const { default: eventBus } = await import('./application/events/eventBus.js');
    await eventBus.verifyRequiredListeners();
    logger.info('[Worker] Event listeners registered');

    await testConnection();
    logger.info('[Worker] Database connected');

    const { verifyRequiredIndexes } = await import('./application/bootstrap/schemaCheck.js');
    await verifyRequiredIndexes();

    await servicesLoader();
    await cronLoader();

    const { scheduleFulfillmentRetry } = await import('./application/cron/paymentCron.js');
    scheduleFulfillmentRetry();
    logger.info('[Worker] Started background services, cron jobs, and fulfillment retry');
}

startWorker().catch(error => {
    logger.error('[Worker] Failed to start:', error);
    alertThenExit(error, 'Worker failed to start (fatal)');
});

const shutdown = async (signal) => {
    logger.info(`[Worker] ${signal} received. Shutting down gracefully.`);
    try {
        const { pool } = await import('./infrastructure/database/database.js');
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
    alertThenExit(error, 'Worker unhandled promise rejection (fatal)');
});
process.on('uncaughtException', (error) => {
    logger.error('[Worker] Uncaught exception:', error);
    alertThenExit(error, 'Worker uncaught exception (fatal)');
});
