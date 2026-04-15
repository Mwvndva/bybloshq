import { container } from '../../container.js';
import logger from '../../utils/logger.js';

export class ProcessPendingPaymentsJob {
    constructor(queue) {
        this.queue = queue;
        this.name = 'process-pending-payments';
    }

    async register() {
        this.queue.process(this.name, this.execute.bind(this));
    }

    async execute({ data = {} }) {
        const hoursAgo = data.hoursAgo || 24;
        const limit = data.limit || 50;
        const startTime = Date.now();

        try {
            // Logic from legacy PaymentService.processPendingPayments
            // This would normally call a PaymentProvider or use the Repository to find/update
            const result = await container.paymentRepository.findPendingByTimeRange(hoursAgo, limit);

            let successCount = 0;
            let errorCount = 0;

            for (const payment of result) {
                try {
                    // Check status with provider
                    const status = await container.paymentProvider.checkPaymentStatus(payment.providerReference);

                    if (status.isCompleted) {
                        await container.handlePaymentCallback.execute(status.callbackData);
                        successCount++;
                    }
                } catch (err) {
                    logger.error(`[${this.name}] Failed to process payment ${payment.id}:`, err.message);
                    errorCount++;
                }
            }

            const duration = (Date.now() - startTime) / 1000;
            logger.info(`[${this.name}] Processed ${result.length} payments in ${duration.toFixed(2)}s`, {
                successCount,
                errorCount
            });

        } catch (err) {
            logger.error(`[${this.name}] Job failed:`, err.message);
        }
    }
}
