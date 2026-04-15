import crypto from 'crypto';

export class VerifyEmail {
    constructor({ userRepository, pendingRegistrationRepository, sellerRepository, buyerRepository, transactionManager }) {
        this.userRepository = userRepository;
        this.pendingRegistrationRepository = pendingRegistrationRepository;
        this.sellerRepository = sellerRepository;
        this.buyerRepository = buyerRepository;
        this.transactionManager = transactionManager;
    }

    async execute({ email, token }) {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        return await this.transactionManager.withTransaction(async (client) => {
            // 1. Check pending
            const pending = await this.pendingRegistrationRepository.findByEmailAndToken(email, hashedToken, client);
            if (!pending) throw new Error('Invalid or expired token.');

            // 2. Create actual user
            const user = await this.userRepository.create({
                email: pending.email,
                passwordHash: pending.passwordHash,
                role: pending.role,
                isVerified: true
            }, client);

            // 3. Create profile
            if (pending.role === 'seller') {
                await this.sellerRepository.create({ ...pending.registrationData, userId: user.id }, client);
            } else {
                await this.buyerRepository.create({ ...pending.registrationData, userId: user.id }, client);
            }

            // 4. Cleanup
            await this.pendingRegistrationRepository.deleteByEmail(email, client);

            return { user };
        });
    }
}
