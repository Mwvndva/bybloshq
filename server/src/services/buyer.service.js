import bcrypt from 'bcrypt';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import Buyer from '../models/buyer.model.js';
import { signToken } from '../utils/jwt.js';
import User from '../models/user.model.js';

class BuyerService {
    static async register(data) {
        const { fullName, email, phone, mobilePayment, whatsappNumber, mobile_payment: mp, whatsapp_number: wn, password, city, location } = data;
        const mobile_payment = mp || mobilePayment || phone;
        const whatsapp_number = whatsappNumber || wn || phone;

        const client = await (await import('../config/database.js')).pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Check if user already exists
            const existingUserResult = await client.query('SELECT * FROM users WHERE email = $1 FOR UPDATE', [email.toLowerCase()]);
            const existingUser = existingUserResult.rows[0];

            if (existingUser) {
                const isPasswordCorrect = await User.verifyPassword(password, existingUser.password_hash);
                if (!isPasswordCorrect) {
                    logger.info(`[DEBUG] BuyerService: Password check FAILED for existing user ${email}`);
                    throw new Error('An account with this email already exists. Please login or use the correct password.');
                }
                logger.info(`[DEBUG] BuyerService: Password check SUCCESS for existing user ${email}`);

                let buyer = await Buyer.findByUserId(existingUser.id);
                if (buyer) {
                    throw new Error('A buyer account with this email already exists.');
                }

                buyer = await Buyer.create({
                    fullName, email, mobilePayment: mobile_payment, whatsappNumber: whatsapp_number, city, location, userId: existingUser.id
                }, client);

                // Ensure role exists in user_roles
                const roleResult = await client.query('SELECT id FROM roles WHERE slug = $1', ['buyer']);
                if (roleResult.rows[0]) {
                    await client.query(
                        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [existingUser.id, roleResult.rows[0].id]
                    );
                }

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
                    const logger = (await import('../utils/logger.js')).default;
                    logger.warn('[REGISTER] Failed to invalidate cross-role cache:', cacheErr.message);
                }

                return buyer;
            }

            // 2. Create new User + Profile atomically
            const newUser = await User.create({ email, password, role: 'buyer', is_verified: false }, client);
            const buyer = await Buyer.create({
                fullName, email, mobilePayment: mobile_payment, whatsappNumber: whatsapp_number, city, location, userId: newUser.id
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
                const logger = (await import('../utils/logger.js')).default;
                logger.warn('[REGISTER] Failed to invalidate cross-role cache:', cacheErr.message);
            }

            return buyer;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async registerGuest(data) {
        const { fullName, email, phone, mobilePayment, whatsappNumber, mobile_payment: mp, whatsapp_number: wn, city, location, password } = data;
        const mobile_payment = mobilePayment || mp || phone;
        const whatsapp_number = whatsappNumber || wn || phone;

        const client = await (await import('../config/database.js')).pool.connect();
        try {
            await client.query('BEGIN');

            const existingUserResult = await client.query('SELECT * FROM users WHERE email = $1 FOR UPDATE', [email.toLowerCase()]);
            const existingUser = existingUserResult.rows[0];

            if (existingUser) {
                const isPasswordCorrect = await User.verifyPassword(password, existingUser.password_hash);
                if (!isPasswordCorrect) {
                    const error = new Error('An account with this email already exists. Please login or use the correct password.');
                    error.requiresLogin = true;
                    throw error;
                }

                let buyer = await Buyer.findByUserId(existingUser.id);
                if (!buyer) {
                    buyer = await Buyer.create({
                        fullName, email, mobilePayment: mobile_payment, whatsappNumber: whatsapp_number, city, location, userId: existingUser.id
                    }, client);
                }

                const roleResult = await client.query('SELECT id FROM roles WHERE slug = $1', ['buyer']);
                if (roleResult.rows[0]) {
                    await client.query(
                        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [existingUser.id, roleResult.rows[0].id]
                    );
                }

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
                    const logger = (await import('../utils/logger.js')).default;
                    logger.warn('[REGISTER] Failed to invalidate cross-role cache:', cacheErr.message);
                }

                return { buyer };
            }

            const newUser = await User.create({ email, password, role: 'buyer', is_verified: false }, client);
            const buyer = await Buyer.create({
                fullName, email, mobilePayment: mobile_payment, whatsappNumber: whatsapp_number, city, location, userId: newUser.id
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
                const logger = (await import('../utils/logger.js')).default;
                logger.warn('[REGISTER] Failed to invalidate cross-role cache:', cacheErr.message);
            }

            return { buyer };
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

        // 3. Fetch buyer profile strictly linked to this user identity
        const buyer = await Buyer.findByUserId(userFound.id);
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
