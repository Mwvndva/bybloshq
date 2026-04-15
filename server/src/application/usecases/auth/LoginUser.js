import bcrypt from 'bcrypt';
import { signToken } from '../../../utils/jwt.js';

export class LoginUser {
    constructor({ userRepository, pendingRegistrationRepository, sellerRepository, buyerRepository }) {
        this.userRepository = userRepository;
        this.pendingRegistrationRepository = pendingRegistrationRepository;
        this.sellerRepository = sellerRepository;
        this.buyerRepository = buyerRepository;
    }

    async execute({ email, password, portalType }) {
        const normalizedEmail = email.toLowerCase().trim();

        // 1. Check if user exists in either table
        let user = await this.userRepository.findByEmail(normalizedEmail);
        let isPending = false;

        if (!user) {
            user = await this.pendingRegistrationRepository.findByEmail(normalizedEmail);
            isPending = !!user;
        }

        // 2. Anti-enumeration dummy hash
        const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789.abcdefghijk';
        const hashToCompare = user ? (user.passwordHash || user.password_hash) : DUMMY_HASH;
        const isMatch = await bcrypt.compare(password, hashToCompare);

        if (!user || !isMatch) return null;

        // 3. Handle Pending state
        if (isPending) {
            const err = new Error("Account not verified.");
            err.code = 'PENDING_VERIFICATION';
            err.statusCode = 403;
            throw err;
        }

        // 4. Handle Role/Portal logic
        const targetType = portalType || user.role;
        let profile = null;

        if (targetType === 'seller') {
            profile = await this.sellerRepository.findByUserId(user.id);
        } else if (targetType === 'buyer') {
            profile = await this.buyerRepository.findByUserId(user.id);
        }

        if (!profile && targetType !== 'admin') {
            const err = new Error(`Wrong portal. Registered as ${user.role}.`);
            err.statusCode = 401;
            throw err;
        }

        const token = signToken(user.id, targetType);
        return { user, profile, token };
    }
}
