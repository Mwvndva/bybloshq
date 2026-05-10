import { signToken } from '../shared/utils/jwt.js';
import * as SellerModel from '../models/seller.model.js';
import withdrawalService from './withdrawal.service.js';
import User from '../models/user.model.js';
import ProfileProvisioningService from './profileProvisioning.service.js';

class SellerService {
    static async register(data) {
        return ProfileProvisioningService.createSellerProfileForExistingUser(data);
    }

    static async login(email, password) {
        const userFound = await User.findByEmail(email);
        if (!userFound) return null;

        const isValid = await User.verifyPassword(password, userFound.password_hash);
        if (!isValid) return null;

        return SellerModel.findSellerByUserId(userFound.id);
    }

    static generateToken(seller) {
        const userId = seller.user_id || seller.userId;

        if (!userId) {
            throw new Error('Cannot generate token: seller.user_id is missing. Ensure seller data includes user_id from the users table.');
        }

        return signToken(userId, 'seller');
    }

    static async updateProfile(id, updates) {
        if (updates.password) {
            delete updates.password;
        }
        return SellerModel.updateSeller(id, updates);
    }

    static async createWithdrawalRequest(sellerId, amount, mpesaNumber, mpesaName) {
        return withdrawalService.createWithdrawalRequest({
            entityId: sellerId,
            entityType: 'seller',
            amount,
            mpesaNumber,
            mpesaName
        });
    }
}

export default SellerService;
