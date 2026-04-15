export class UpdateSellerProfile {
    constructor({ sellerRepository }) {
        this.sellerRepository = sellerRepository;
    }

    async execute(sellerId, updateData) {
        // 1. Validation logic could go here or in Domain Entity
        const seller = await this.sellerRepository.findById(sellerId);
        if (!seller) throw new Error('Seller not found');

        // 2. Update
        return await this.sellerRepository.update(sellerId, updateData);
    }
}
