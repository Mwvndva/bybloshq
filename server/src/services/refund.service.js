import Refund from '../models/refund.model.js';
import Buyer from '../models/buyer.model.js';
import { pool } from '../config/database.js';
import { AppError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import whatsappService from './whatsapp.service.js';

class RefundService {
    static async confirmRefund(requestId, adminId, adminNotes) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const request = await Refund.findByIdForUpdate(client, requestId);

            if (!request) {
                throw new AppError('Refund request not found', 404);
            }

            if (request.status !== 'pending') {
                throw new AppError(`Refund request is already ${request.status}`, 400);
            }

            // 2. Lock buyer
            const buyer = await Buyer.findByIdForUpdate(client, request.buyer_id);
            if (!buyer) {
                throw new AppError('Buyer account not found', 404);
            }

            const buyerRefunds = parseFloat(buyer.refunds || 0);
            const requestAmount = parseFloat(request.amount);

            if (buyerRefunds < requestAmount) {
                throw new AppError('Buyer does not have sufficient refund balance', 400);
            }

            // 3. Update status
            const processedBy = typeof adminId === 'number' ? adminId : null;
            await Refund.updateStatus(client, requestId, {
                status: 'completed',
                admin_notes: adminNotes || 'Refund processed successfully',
                processed_by: processedBy
            });

            // 4. Deduct refunds
            await Buyer.adjustRefundBalance(client, request.buyer_id, -requestAmount);

            await client.query('COMMIT');

            // 5. Notify
            try {
                const buyerObj = await Buyer.findById(request.buyer_id);
                if (buyerObj) {
                    await whatsappService.sendRefundApprovedNotification(buyerObj, requestAmount);
                }
            } catch (err) {
                logger.error('[RefundService] WhatsApp notification failed:', err.message);
            }

            return { success: true, amount: requestAmount };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async rejectRefund(requestId, adminId, adminNotes) {
        const request = await Refund.findById(requestId);
        if (!request) {
            throw new AppError('Refund request not found', 404);
        }

        if (request.status !== 'pending') {
            throw new AppError(`Refund request is already ${request.status}`, 400);
        }

        const processedBy = typeof adminId === 'number' ? adminId : null;
        await Refund.updateStatus(null, requestId, {
            status: 'rejected',
            admin_notes: adminNotes || 'Refund request rejected',
            processed_by: processedBy
        });

        // Notify
        try {
            const buyerObj = await Buyer.findById(request.buyer_id);
            if (buyerObj) {
                await whatsappService.sendRefundRejectedNotification(buyerObj, request.amount, adminNotes);
            }
        } catch (err) {
            logger.error('[RefundService] WhatsApp rejection notification failed:', err.message);
        }

        return { success: true };
    }
}

export default RefundService;

