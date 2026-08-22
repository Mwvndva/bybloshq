import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import logger from './shared/utils/logger.js';
import { validateEnvironment } from './shared/config/validateEnv.js';
import loaders from './application/bootstrap/index.js';

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', err);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
  process.exit(1);
});

// Load environment variables
dotenv.config();

/**
 * Start Server
 */
async function startServer() {
  const app = express();

  // 1. Validate Environment
  validateEnvironment();

  // 2. Boot Event Listeners before any loader can start retry workers, cron, or outbox replay.
  await import('./application/events/order.events.js');
  await import('./application/events/payment.events.js');
  await import('./application/events/logistics.events.js');
  const { default: eventBus } = await import('./application/events/eventBus.js');
  await eventBus.verifyRequiredListeners();
  logger.info('[EventBus] All event listeners registered');

  // 2b. Initialize Loaders (DB, Express, Cron, Services)
  await loaders(app);

  // 2c. Boot the unified fulfillment-retry cron unless this is an API-only process.
  const processRole = String(process.env.BYBLOS_PROCESS_ROLE || 'all').toLowerCase();
  if (!['api', 'web'].includes(processRole)) {
    const { scheduleFulfillmentRetry } = await import('./application/cron/paymentCron.js');
    scheduleFulfillmentRetry();
    logger.info('[Cron] Unified fulfillment-retry cron registered (checks needs_fulfillment + needs_completion)');
  } else {
    logger.info('[Cron] Unified fulfillment-retry cron skipped for API-only process role', { processRole });
  }
  // 3. Start Listening
  const PORT = process.env.PORT || 3002;
  const server = http.createServer(app);

  server.listen(PORT, () => {
    logger.info(`
            ################################################
            🛡️  Server listening on port: ${PORT} 🛡️
            ################################################
        `);
  });

  // Increase timeouts for large file uploads
  server.timeout = 600000; // 10 minutes
  server.keepAliveTimeout = 600000;
  server.headersTimeout = 601000; // slightly more than keepAliveTimeout

  // Handle Unhandled Rejections
  process.on('unhandledRejection', (err) => {
    logger.error('💥 UNHANDLED REJECTION! Shutting down...');
    logger.error(err.name, err.message);
    server.close(async () => {
      try {
        const { pool } = await import('./infrastructure/database/database.js');
        await pool.end();
        logger.info('📦 Database pool closed');
      } catch (poolErr) {
        logger.error('❌ Error closing pool:', poolErr);
      }
      logger.info('Graceful shutdown complete');
      process.exit(1);
    });
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
    const forceExit = setTimeout(() => {
      logger.error('❌ Forced shutdown triggered after 10s connection drain timeout');
      process.exit(1);
    }, 10000);
    if (forceExit.unref) forceExit.unref();

    server.close(async () => {
      clearTimeout(forceExit);
      try {
        const { pool } = await import('./infrastructure/database/database.js');
        await pool.end();
        logger.info('📦 Database pool closed');
      } catch (poolErr) {
        logger.error('❌ Error closing pool:', poolErr);
      } finally {
        logger.info('Graceful shutdown complete');
        process.exit(0);
      }
    });
  });
}

startServer().catch(err => {
  logger.error('❌ Failed to start server:', err);
  process.exit(1);
});
