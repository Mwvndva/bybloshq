export class InitiatePayment {
    constructor({ paymentRepository, paymentProvider, transactionManager }) {
        this.paymentRepository = paymentRepository;
        this.paymentProvider = paymentProvider;
        this.transactionManager = transactionManager;
    }

    async execute({ orderId, amount, phone, email, callbackUrl }) {
        // 1. Create payment record in pending state
        const payment = await this.paymentRepository.create({
            invoiceId: orderId,
            amount,
            phone,
            email,
            status: 'pending',
            paymentMethod: 'MPESA'
        });

        try {
            // 2. Call external provider
            const response = await this.paymentProvider.initiateSTKPush({
                amount,
                phone,
                invoiceId: orderId,
                callbackUrl
            });

            // 3. Update with provider reference
            await this.paymentRepository.update(payment.id, {
                providerReference: response.reference,
                metadata: { ...payment.metadata, providerResponse: response.originalResponse }
            });

            return { success: true, paymentId: payment.id, reference: response.reference };
        } catch (error) {
            await this.paymentRepository.update(payment.id, {
                status: 'failed',
                metadata: { ...payment.metadata, error: error.message }
            });
            throw error;
        }
    }
}
