import whatsappService from '../services/whatsapp.service.js';
import WithdrawalService from '../services/withdrawal.service.js';
import logger from '../utils/logger.js';

export default async (app) => {
    // 1. WhatsApp Service
    logger.info('📱 Initializing WhatsApp service...');
    whatsappService.initialize().catch(err => {
        logger.error('⚠️  WhatsApp initialization failed:', err.message);
    });

    // 2. Withdrawal Crash Recovery
    WithdrawalService.retryPendingApiCalls().catch(err => {
        logger.error('⚠️  Withdrawal retry failed:', err.message);
    });
};
