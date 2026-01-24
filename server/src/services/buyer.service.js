import bcrypt from 'bcryptjs';
import Buyer from '../models/buyer.model.js';
import { signToken } from '../utils/jwt.js';

class BuyerService {
    static async register(data) {
        const { fullName, email, phone, password, city, location } = data;
        const hashedPassword = await bcrypt.hash(password, 10);
        return await Buyer.create({
            fullName, email, phone, password: hashedPassword, city, location
        });
    }

    static async login(email, password) {
        const buyer = await Buyer.findByEmail(email);
        if (!buyer) return null;

        const valid = await bcrypt.compare(password, buyer.password);
        if (!valid) return null;

        return buyer;
    }

    static signToken(buyer) {
        // CRITICAL: Use user_id (from users table) not id (from buyers table)
        const userId = buyer.user_id || buyer.userId;

        if (!userId) {
            throw new Error('Cannot generate token: buyer.user_id is missing. Ensure buyer data includes user_id from the users table.');
        }

        return signToken(userId, 'buyer');
    }
}

export default BuyerService;
