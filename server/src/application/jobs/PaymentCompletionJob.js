import { container } from '../../container.js';
import logger from '../../utils/logger.js';

export class PaymentCompletionJob {
    constructor(queue) {
        this.queue = queue;
        this.name = 'payment-completion-retry';
    }

    async register() {
        this.queue.process(this.name, this.execute.bind(this));
    }

    async execute() {
        const jobId = `job-${Date.now()}`;
        try {
            // Use repository to find pending completions
            const payments = await container.paymentRepository.findPendingCompletions(20);

            if (payments.length === 0) return;

            logger.info(`[${this.name}] Found ${payments.length} payment(s) needing completion retry`);

            for (const payment of payments) {
                try {
                    // Use UseCase instead of Service
                    await container.completeOrder.execute(payment.invoiceId);

                    // Clear flag via repository
                    await container.paymentRepository.clearCompletionFlag(payment.id);
                    logger.info(`[${this.name}] Successfully completed payment ${payment.id}`);
                } catch (err) {
                    logger.error(`[${this.name}] Retry failed for payment ${payment.id}:`, err.message);
                }
            }
        } catch (err) {
            logger.error(`[${this.name}] Job error:`, err.message);
        }
    }
}
