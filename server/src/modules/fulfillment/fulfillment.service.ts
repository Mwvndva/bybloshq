import logger from '../../shared/utils/logger.js';
import OrderModel from '../orders/order.model.js';
import LogisticsService from '../logistics/logistics.service.js';
import BookingService from '../bookings/booking.service.js';
import DigitalAccessService from '../access/digitalAccess.service.js';

class FulfillmentService {
    /**
     * Entry point after successful payment
     */
    static async handlePaymentSuccess(orderId: number) {
        logger.info(`[Fulfillment] Handling payment success for Order ${orderId}`);

        // 1. Fetch Order
        const order = await OrderModel.findById(orderId);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        // 1b. Idempotency Guard: Skip if already processed (CRITICAL FIX: FULFILLMENT-IDEMPOTENCY)
        const terminalStatuses = ['COMPLETED', 'COLLECTION_PENDING', 'DELIVERY_PENDING', 'SERVICE_PENDING', 'FAILED', 'CANCELLED', 'EXPIRED'];
        if (terminalStatuses.includes(order.status)) {
            logger.warn(`[Fulfillment] Order ${orderId} is already in terminal/processed status (${order.status}). Skipping fulfillment.`);
            return;
        }

        // 2. Delegate based on type
        switch (order.order_type) {
            case 'PHYSICAL':
                return LogisticsService.handleDelivery(order);
            case 'SERVICE':
                return BookingService.confirmBooking(order);
            case 'DIGITAL':
                return DigitalAccessService.grantAccess(order);
            default:
                logger.error(`[Fulfillment] Unknown order type: ${order.order_type}`);
                throw new Error(`Unknown order type: ${order.order_type}`);
        }
    }
}

export default FulfillmentService;
