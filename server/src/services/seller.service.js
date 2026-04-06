import bcrypt from 'bcrypt';
import { signToken } from '../utils/jwt.js';
import { query, pool } from '../config/database.js'; // Assuming query is exported
import * as SellerModel from '../models/seller.model.js';
import logger from '../utils/logger.js';
import withdrawalService from './withdrawal.service.js';

const SALT_ROUNDS = 10;

import User from '../models/user.model.js';

class SellerService {

    // --- Auth ---
    static async register(data) {
        const { fullName, shopName, email, phone, whatsappNumber, password, city, location, physicalAddress, latitude, longitude } = data;
        const whatsapp_number = whatsappNumber || phone;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Check if user already exists
            const existingUserResult = await client.query('SELECT * FROM users WHERE email = $1 FOR UPDATE', [email.toLowerCase()]);
            const existingUser = existingUserResult.rows[0];

            if (existingUser) {
                const isPasswordCorrect = await User.verifyPassword(password, existingUser.password_hash);
                if (!isPasswordCorrect) {
                    throw new Error('An account with this email already exists. Please login or use the correct password.');
                }

                const existingSeller = await SellerModel.findSellerByUserId(existingUser.id);
                if (existingSeller) {
                    throw new Error('A seller account with this email already exists.');
                }

                const seller = await SellerModel.createSeller({
                    fullName, shopName, email, whatsappNumber: whatsapp_number, city, location, physicalAddress, latitude, longitude, userId: existingUser.id
                }, client);

                // Add seller role
                const roleResult = await client.query('SELECT id FROM roles WHERE slug = $1', ['seller']);
                if (roleResult.rows[0]) {
                    await client.query(
                        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [existingUser.id, roleResult.rows[0].id]
                    );
                }

                await client.query('COMMIT');

                // If existing user isn't verified, send verification email
                if (!existingUser.is_verified) {
                    const { default: AuthService } = await import('./auth.service.js');
                    AuthService.sendEmailVerification(email, 'seller').catch(err =>
                        logger.error('[AUTH] Failed to send verification email to existing user:', err.message)
                    );
                }

                // Invalidate cross-role cache for this user
                try {
                    const CacheService = (await import('./cache.service.js')).default;
                    const userId = existingUser?.id;
                    if (userId) {
                        await CacheService.delete(`user:${userId}:cross-roles`);
                    }
                } catch (cacheErr) {
                    // Non-critical — cache will expire naturally
                    logger.warn('[REGISTER] Failed to invalidate cross-role cache:', cacheErr.message);
                }

                return seller;
            }

            // 2. Create new User + Profile atomically
            const newUser = await User.create({ email, password, role: 'seller', is_verified: false }, client);
            const seller = await SellerModel.createSeller({
                fullName, shopName, email, whatsappNumber: whatsapp_number, city, location, physicalAddress, latitude, longitude, userId: newUser.id
            }, client);

            await client.query('COMMIT');

            // Invalidate cross-role cache for this user
            try {
                const CacheService = (await import('./cache.service.js')).default;
                const userId = newUser?.id;
                if (userId) {
                    await CacheService.delete(`user:${userId}:cross-roles`);
                }
            } catch (cacheErr) {
                // Non-critical — cache will expire naturally
                logger.warn('[REGISTER] Failed to invalidate cross-role cache:', cacheErr.message);
            }

            return seller;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async login(email, password) {
        // 1. Find user in unified users table
        const userFound = await User.findByEmail(email);
        if (!userFound) return null;

        // 2. Verify password against unified user record
        const isValid = await User.verifyPassword(password, userFound.password_hash);
        if (!isValid) return null;

        // 3. Fetch seller profile strictly linked to this user identity
        const seller = await SellerModel.findSellerByUserId(userFound.id);
        return seller;
    }

    static generateToken(seller) {
        // CRITICAL: Use user_id (from users table) not id (from sellers table)
        // The auth middleware expects the JWT to contain the user ID from the unified users table
        const userId = seller.user_id || seller.userId;

        if (!userId) {
            throw new Error('Cannot generate token: seller.user_id is missing. Ensure seller data includes user_id from the users table.');
        }

        return signToken(userId, 'seller');
    }

    // --- Profile ---
    static async updateProfile(id, updates) {
        // Password updates should be handled via dedicated change-password flow
        if (updates.password) {
            delete updates.password;
        }
        return await SellerModel.updateSeller(id, updates);
    }

    // --- Financials ---
    static async createWithdrawalRequest(sellerId, amount, mpesaNumber, mpesaName) {
        return await withdrawalService.createWithdrawalRequest({
            entityId: sellerId,
            entityType: 'seller',
            amount,
            mpesaNumber,
            mpesaName
        });
    }
}

export default SellerService;
