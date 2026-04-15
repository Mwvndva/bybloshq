import { container } from '../../container.js';
import logger from '../../utils/logger.js';

export class PayoutCleanupJob {
    constructor(queue) {
        this.queue = queue;
        this.name = 'payout-cleanup';
    }

    async register() {
        this.queue.process(this.name, this.execute.bind(this));
    }

    async execute() {
        try {
            // Find stuck processing withdrawals
            const stuckWithdrawals = await container.withdrawalRepository.findStuckWithdrawals();

            for (const withdrawal of stuckWithdrawals) {
                try {
                    // Check status with provider
                    const status = await container.payoutProvider.checkPayoutStatus(withdrawal.providerReference);

                    if (status.isCompleted || status.isFailed) {
                        await container.handleWithdrawalCallback.execute(status.callbackData);
                    }
                } catch (err) {
                    logger.error(`[${this.name}] Failed to clean up withdrawal ${withdrawal.id}:`, err.message);
                }
            }
        } catch (err) {
            logger.error(`[${this.name}] Job failed:`, err.message);
        }
    }
}
