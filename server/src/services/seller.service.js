import { signToken } from '../utils/jwt.js';
import * as SellerModel from '../models/seller.model.js';
import logger from '../utils/logger.js';
import withdrawalService from './withdrawal.service.js';
import User from '../models/user.model.js';
import { pool } from '../config/database.js';

class SellerService {

    // --- Auth ---
    static async register(data) {
        const { fullName, shopName, email, phone, whatsappNumber, password, city, location, physicalAddress, latitude, longitude } = data;
        const whatsapp_number = whatsappNumber || phone;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Check if user already exists
            const existingUser = await User.findByEmailForUpdate(client, email);

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
                await User.linkRole(client, existingUser.id, 'seller');

                await client.query('COMMIT');

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

            if (!existingUser) {
                // New users must go through AuthService.register (pending_registrations + email verification)
                await client.query('ROLLBACK');
                client.release();
                const AuthSvc = (await import('./auth.service.js')).default;
                return await AuthSvc.register(data, 'seller');
            }
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
        const userId = seller.user_id || seller.userId;

        if (!userId) {
            throw new Error('Cannot generate token: seller.user_id is missing. Ensure seller data includes user_id from the users table.');
        }

        return signToken(userId, 'seller');
    }

    // --- Profile ---
    static async updateProfile(id, updates) {
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

