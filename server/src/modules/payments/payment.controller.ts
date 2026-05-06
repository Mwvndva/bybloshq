import { Request, Response } from 'express';
import logger from '../../shared/utils/logger.js';
import paymentService from './payment.service.js';
import { normalizeOrderInput } from '../../shared/utils/order.utils';

class PaymentController {
    /**
     * Handle Payd webhook
     */
    async handlePaydWebhook(req: Request, res: Response) {
        const webhookData = req.body;

        logger.info('[Payment] Webhook received', {
            reference: webhookData.transaction_reference,
            status: webhookData.status
        });

        // Respond 200 immediately
        res.status(200).json({ received: true });

        // Process async
        setImmediate(async () => {
            try {
                await paymentService.handleCallback(webhookData);
            } catch (error: any) {
                logger.error('[Payment] Webhook processing failed:', error.message);
            }
        });
    }

    /**
     * Initiate payment for products
     */
    async initiateProductPayment(req: Request, res: Response) {
        try {
            const normalizedOrder = await normalizeOrderInput(req);

            const result = await paymentService.initiateProductPayment(normalizedOrder);

            if (result.success) {
                res.status(200).json({
                    status: 'success',
                    message: 'Payment initiated. Please check your phone.',
                    data: result
                });
            } else {
                res.status(400).json({
                    status: 'error',
                    message: result.error
                });
            }
        } catch (error: any) {
            logger.error('[Payment] Initiation failed:', error.message);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error during payment initiation',
                error: error.message
            });
        }
    }
}

export default new PaymentController();
