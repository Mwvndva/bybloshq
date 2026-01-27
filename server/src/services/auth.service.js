
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import BuyerService from './buyer.service.js';
import SellerService from './seller.service.js';
import OrganizerService from './organizer.service.js';
import Organizer from '../models/organizer.model.js';
import * as SellerModel from '../models/seller.model.js';
import Buyer from '../models/buyer.model.js';
import { signToken } from '../utils/jwt.js';
import { sendPasswordResetEmail } from '../utils/email.js';

class AuthService {
    /**
     * Unified login method
     * @param {string} email 
     * @param {string} password 
     * @param {string} type - Optional, enforced role check
      */
    static async login(email, password, type = null) {
        // 1. Find user in unified users table
        const user = await User.findByEmail(email);
        if (!user) return null;

        // 2. Verify password
        const isMatch = await User.verifyPassword(password, user.password_hash);
        if (!isMatch) return null;

        // 3. Check role if specified
        if (type && user.role !== type) {
            // logic for strict role check if needed
        }

        // 4. Fetch Profile based on requested type or user.role
        const targetType = type || user.role;
        let profile = null;

        switch (targetType) {
            case 'organizer':
                profile = await Organizer.findByEmail(email);
                break;
            case 'seller':
                profile = await SellerModel.findSellerByEmail(email);
                break;
            case 'buyer':
                profile = await Buyer.findByEmail(email);
                break;
            case 'admin':
                if (user.role === 'admin') profile = { id: user.id, email: user.email, role: 'admin' };
                break;
            default:
                // Attempt to find profile if mismatch? No, strict.
                break;
        }

        if (!profile && targetType !== 'admin') {
            return null;
        }

        // 5. Generate Token using Unified User ID
        const token = signToken(user.id, targetType);

        return { user, profile, token };
    }

    /**
     * Register delegation
     * @param {Object} data 
     * @param {string} type 
     */
    static async register(data, type) {
        switch (type) {
            case 'organizer':
                return await OrganizerService.register(data);
            case 'seller':
                return await SellerService.register(data);
            case 'buyer':
                return await BuyerService.register(data);
            default:
                throw new Error('Invalid registration type');
        }
    }

    /**
     * Request Password Reset
     * @param {string} email 
     * @param {string} type - 'buyer', 'seller', 'organizer'
     */
    static async forgotPassword(email, type) {
        const user = await User.findByEmail(email);
        if (!user) {
            return true;
        }

        // Generate token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save to User table
        await User.setPasswordResetToken(email, hashedToken, passwordResetExpires);

        try {
            await sendPasswordResetEmail(email, resetToken, type);
            return true;
        } catch (err) {
            await User.setPasswordResetToken(email, null, null);
            throw new Error('There was an error sending the email. Try again later!');
        }
    }

    /**
     * Reset Password
     * @param {string} email
     * @param {string} token 
     * @param {string} newPassword 
     */
    static async resetPassword(email, token, newPassword) {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Verify token
        const isValid = await User.verifyPasswordResetToken(email, hashedToken);
        if (!isValid) throw new Error('Token is invalid or has expired');

        // Reset
        return await User.resetPassword(email, newPassword);
    }
}

export default AuthService;
