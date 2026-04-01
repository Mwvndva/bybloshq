import crypto from 'crypto';
import bcrypt from 'bcrypt';
import User from '../models/user.model.js';
import BuyerService from './buyer.service.js';
import SellerService from './seller.service.js';
import * as SellerModel from '../models/seller.model.js';
import Buyer from '../models/buyer.model.js';
import { signToken } from '../utils/jwt.js';
import { sendPasswordResetEmail } from '../utils/email.js';
import { pool } from '../config/database.js';

class AuthService {
    /**
     * Unified login method
     * @param {string} email 
     * @param {string} password 
     * @param {string} type - Optional portal type: 'buyer' | 'seller' | 'admin'
     */
    static async login(email, password, type = null) {
        const user = await User.findByEmail(email);
        if (!user) return null;

        const isMatch = await User.verifyPassword(password, user.password_hash);
        if (!isMatch) return null;

        // ── Role mismatch handling ──────────────────────────────────────────
        if (type && user.role !== type) {

            // CASE 1: A seller or admin trying to access the BUYER portal
            // They can if they also have a buyer profile
            if (type === 'buyer') {
                let buyerProfile = await Buyer.findByUserId(user.id);

                // Lazy-link legacy buyer profile if it exists by email
                if (!buyerProfile) {
                    buyerProfile = await Buyer.findByEmail(user.email);
                    if (buyerProfile && !buyerProfile.userId) {
                        await pool.query(
                            'UPDATE buyers SET user_id = $1 WHERE id = $2 AND user_id IS NULL',
                            [user.id, buyerProfile.id]
                        );
                        buyerProfile.userId = user.id;
                        buyerProfile.user_id = user.id;
                    }
                }

                if (buyerProfile && (buyerProfile.userId === user.id || buyerProfile.user_id === user.id)) {
                    const token = signToken(user.id, 'buyer');
                    return { user, profile: buyerProfile, token, crossRole: true };
                }
            }

            // CASE 2: A buyer or admin trying to access the SELLER portal
            // They can if they also have a seller profile
            if (type === 'seller') {
                let sellerProfile = await SellerModel.findSellerByUserId(user.id);

                // Lazy-link legacy seller profile if it exists by email
                if (!sellerProfile) {
                    sellerProfile = await SellerModel.findSellerByEmail(user.email);
                    if (sellerProfile && !sellerProfile.userId) {
                        await pool.query(
                            'UPDATE sellers SET user_id = $1 WHERE id = $2 AND user_id IS NULL',
                            [user.id, sellerProfile.id]
                        );
                        sellerProfile.userId = user.id;
                        sellerProfile.user_id = user.id;
                    }
                }

                if (sellerProfile && (sellerProfile.userId === user.id || sellerProfile.user_id === user.id)) {
                    // Issue a token scoped to 'seller' role
                    const token = signToken(user.id, 'seller');
                    return { user, profile: sellerProfile, token, crossRole: true };
                }
            }

            // No cross-role profile found — typed 401 so controller can give clear message
            const err = new Error(`Wrong portal. This account is registered as a ${user.role}.`);
            err.statusCode = 401;
            err.isRoleMismatch = true;
            throw err;
        }
        // ── End role mismatch handling ──────────────────────────────────────

        // Normal path: role matches type (or type is null)
        const targetType = type || user.role;
        let profile = null;

        switch (targetType) {
            case 'seller':
                profile = await SellerModel.findSellerByUserId(user.id);
                break;
            case 'buyer':
                profile = await Buyer.findByUserId(user.id);
                // Legacy buyer: no user_id link yet — find by email and link now
                if (!profile) {
                    profile = await Buyer.findByEmail(user.email);
                    if (profile && !profile.userId) {
                        // Lazily link the legacy buyer to the unified users record
                        await pool.query(
                            'UPDATE buyers SET user_id = $1 WHERE id = $2 AND user_id IS NULL',
                            [user.id, profile.id]
                        );
                        profile.userId = user.id;
                        profile.user_id = user.id;
                    }
                }
                break;
            case 'admin':
                if (user.role === 'admin') profile = { id: user.id, email: user.email, role: 'admin' };
                break;
        }

        if (!profile && targetType !== 'admin') return null;

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
     * @param {string} type - 'buyer', 'seller'
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