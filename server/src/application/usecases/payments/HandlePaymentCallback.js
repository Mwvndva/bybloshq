export class HandlePaymentCallback {
    constructor({ paymentRepository, orderRepository, completeOrderUseCase, transactionManager }) {
        this.paymentRepository = paymentRepository;
        this.orderRepository = orderRepository;
        this.completeOrderUseCase = completeOrderUseCase;
        this.transactionManager = transactionManager;
    }

    async execute(callbackData) {
        const { transaction_reference, status, message } = callbackData;

        return await this.transactionManager.withTransaction(async (client) => {
            // 1. Find payment (with lock to prevent concurrent callback processing)
            const payment = await this.paymentRepository.findByReferenceWithLock(transaction_reference, client);
            if (!payment) throw new Error('Payment not found');

            if (payment.status === 'completed') return { success: true, alreadyProcessed: true };

            // 2. Update payment status
            const isSuccess = status === 'success' || status === 'completed';
            await this.paymentRepository.update(payment.id, {
                status: isSuccess ? 'completed' : 'failed',
                metadata: { ...payment.metadata, callbackResponse: callbackData }
            }, client);

            // 3. If success, trigger order completion
            if (isSuccess) {
                const orderId = payment.invoiceId || payment.invoice_id;
                const order = await this.orderRepository.findByOrderNumber(orderId, client);
                if (order) {
                    await this.completeOrderUseCase.execute(order.id, client);
                }
            }

            return { success: true };
        });
    }
}
