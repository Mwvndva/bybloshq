import User from '../models/user.model.js';

class BuyerService {
    static async register(data) {
        const { fullName, email, phone, password, city, location } = data;

        // 1. Check if user already exists in unified users table
        const existingUser = await User.findByEmail(email);

        if (existingUser) {
            // 2. User exists - verify password matches
            const isPasswordCorrect = await User.verifyPassword(password, existingUser.password_hash);
            if (!isPasswordCorrect) {
                throw new Error('An account with this email already exists. Please login or use the correct password to link this profile.');
            }

            // 3. Password correct - check if they already have a buyer profile
            const existingBuyer = await Buyer.findByEmail(email);
            if (existingBuyer) {
                throw new Error('A buyer account with this email already exists.');
            }

            // 4. Link new buyer profile to existing user identity
            return await Buyer.create({
                fullName, email, phone, city, location, userId: existingUser.id
            });
        }

        // 5. No user exists - create BOTH user and profile
        // Create user first
        const newUser = await User.create({
            email,
            password,
            role: 'buyer',
            is_verified: true
        });

        // Create buyer profile linked to new user
        return await Buyer.create({
            fullName, email, phone, city, location, userId: newUser.id
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
