export class RegisterSellerProfile {
    constructor({ sellerRepository, userRepository, transactionManager }) {
        this.sellerRepository = sellerRepository;
        this.userRepository = userRepository;
        this.transactionManager = transactionManager;
    }

    async execute(userId, sellerData) {
        return await this.transactionManager.withTransaction(async (client) => {
            // 1. Check if user exists
            const user = await this.userRepository.findById(userId, client);
            if (!user) throw new Error('User not found');

            // 2. Check if already a seller
            const existingSeller = await this.sellerRepository.findByUserId(userId, client);
            if (existingSeller) throw new Error('Seller profile already exists for this user.');

            // 3. Create seller profile
            const seller = await this.sellerRepository.create({
                ...sellerData,
                userId: user.id
            }, client);

            return seller;
        });
    }
}
