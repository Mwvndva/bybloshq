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
        return signToken(buyer.id, 'buyer');
    }
}

export default BuyerService;
