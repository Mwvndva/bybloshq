import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { validateEnvironment } from './config/validateEnv.js';
import loaders from './loaders/index.js';

// Load environment variables
dotenv.config();

/**
 * Start Server
 */
async function startServer() {
  const app = express();

  // 1. Validate Environment
  validateEnvironment();

  // 2. Initialize Loaders (DB, Express, Cron, Services)
  await loaders(app);

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

  // Handle Unhandled Rejections
  process.on('unhandledRejection', (err) => {
    logger.error('💥 UNHANDLED REJECTION! Shutting down...');
    logger.error(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
      logger.info('💥 Process terminated!');
    });
  });
}

startServer().catch(err => {
  logger.error('❌ Failed to start server:', err);
  process.exit(1);
});
