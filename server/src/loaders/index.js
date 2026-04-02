import expressLoader from './express.js';
import cronLoader from './cron.js';
import servicesLoader from './services.js';
import { testConnection } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Main Loader
 * Orchestrates all startup sequences
 * @param {import('express').Application} app 
 */
export default async (app) => {
    logger.info('🚀 Base loaders initializing...');

    // 1. Database
    try {
        await testConnection();
        logger.info('✅ Database connected');

        // 1b. Schema Verification (Fix M-5)
        const { verifyRequiredIndexes } = await import('./schemaCheck.js');
        await verifyRequiredIndexes();
    } catch (err) {
        logger.error('❌ Database connection/verification failed:', err.message);
        process.exit(1);
    }

    // 2. Express & Middleware & Routes
    await expressLoader(app);
    logger.info('✅ Express loaded');

    // 3. Services (WhatsApp, etc.)
    await servicesLoader(app);
    logger.info('✅ Services initialized');

    // 4. Cron Jobs
    await cronLoader(app);
    logger.info('✅ Cron jobs scheduled');

    logger.info('✨ All loaders initialized successfully');
};
