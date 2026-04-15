export class HandleWithdrawalCallback {
    constructor({ withdrawalRepository, sellerRepository, transactionManager, whatsappService }) {
        this.withdrawalRepository = withdrawalRepository;
        this.sellerRepository = sellerRepository;
        this.transactionManager = transactionManager;
        this.whatsappService = whatsappService;
    }

    async execute(callbackData) {
        const { transaction_reference, status, remarks } = callbackData;

        return await this.transactionManager.withTransaction(async (client) => {
            // 1. Find withdrawal
            const withdrawal = await this.withdrawalRepository.findByProviderReference(transaction_reference, client);
            if (!withdrawal) throw new Error('Withdrawal request not found');

            if (['completed', 'failed'].includes(withdrawal.status)) return { success: true };

            // 2. Update status
            const isSuccess = status === 'success' || status === 'completed';
            const newStatus = isSuccess ? 'completed' : 'failed';

            await this.withdrawalRepository.updateStatus(withdrawal.id, newStatus, {
                metadata: { ...withdrawal.metadata, callbackResponse: callbackData }
            }, client);

            // 3. Refund if failed
            if (!isSuccess) {
                await this.sellerRepository.incrementBalance(withdrawal.sellerId, withdrawal.amount, client);
            }

            // 4. Notify (typically async)
            return { success: true };
        });
    }
}
