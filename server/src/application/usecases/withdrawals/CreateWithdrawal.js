export class CreateWithdrawal {
    constructor({ withdrawalRepository, sellerRepository, payoutProvider, transactionManager }) {
        this.withdrawalRepository = withdrawalRepository;
        this.sellerRepository = sellerRepository;
        this.payoutProvider = payoutProvider;
        this.transactionManager = transactionManager;
    }

    async execute({ sellerId, amount, mpesaNumber, mpesaName, callbackUrl }) {
        const result = await this.transactionManager.withTransaction(async (client) => {
            // 1. Fetch and Lock Seller
            const seller = await this.sellerRepository.findByIdWithLock(sellerId, client);
            if (!seller) throw new Error('Seller not found');

            // 2. Validate Balance (Domain logic in entity)
            if (seller.balance < amount) {
                throw new Error('Insufficient balance');
            }

            // 3. Deduct balance
            await this.sellerRepository.update(sellerId, { balance: seller.balance - amount }, client);

            // 4. Create Withdrawal Record
            const withdrawal = await this.withdrawalRepository.create({
                sellerId,
                amount,
                mpesaNumber,
                mpesaName,
                status: 'processing',
                apiCallPending: true
            }, client);

            return { withdrawal, seller };
        });

        // 5. Call external provider (Async, typically outside transaction or in a job)
        try {
            const payoutResponse = await this.payoutProvider.initiatePayout({
                phone: mpesaNumber,
                amount,
                narration: `Withdrawal for ${result.seller.fullName}`,
                callbackUrl
            });

            await this.withdrawalRepository.updateProviderInfo(result.withdrawal.id, payoutResponse.reference, payoutResponse.originalResponse);
        } catch (error) {
            // Handle failure - maybe refund balance or mark as failed
            console.error('Payout failed:', error);
        }

        return result.withdrawal;
    }
}
