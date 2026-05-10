import Buyer from '../models/buyer.model.js';
import * as SellerModel from '../models/seller.model.js';
import User from '../models/user.model.js';
import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';

async function invalidateCrossRoleCache(userId) {
    try {
        const CacheService = (await import('./cache.service.js')).default;
        await CacheService.delete(`user:${userId}:cross-roles`);
    } catch (cacheErr) {
        logger.warn('[PROFILE_PROVISIONING] Failed to invalidate cross-role cache:', cacheErr.message);
    }
}

async function ensureRole(client, userId, roleSlug) {
    const roleResult = await client.query('SELECT id FROM roles WHERE slug = $1', [roleSlug]);
    if (!roleResult.rows[0]) return;

    await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, roleResult.rows[0].id]
    );
}

function identityRequiredError(email, role) {
    const error = new Error(`No verified identity exists for ${email}. Use AuthService.register(data, '${role}') for new account creation.`);
    error.code = 'IDENTITY_REQUIRED';
    return error;
}

function requirePassword(password) {
    if (!password) {
        throw new Error('An account with this email already exists. Please login or use the correct password.');
    }
}

class ProfileProvisioningService {
    static async createBuyerProfileForExistingUser(data) {
        const {
            fullName,
            email,
            phone,
            mobilePayment,
            whatsappNumber,
            mobile_payment: mp,
            whatsapp_number: wn,
            password,
            city,
            location,
            termsAccepted
        } = data;
        const normalizedEmail = (email || '').trim().toLowerCase();
        const mobile_payment = mp || mobilePayment || phone;
        const whatsapp_number = whatsappNumber || wn || phone;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const existingUserResult = await client.query(
                'SELECT id, email, password_hash FROM users WHERE LOWER(email) = $1 FOR UPDATE',
                [normalizedEmail]
            );
            const existingUser = existingUserResult.rows[0];
            if (!existingUser) {
                throw identityRequiredError(normalizedEmail, 'buyer');
            }

            requirePassword(password);
            const isPasswordCorrect = await User.verifyPassword(password, existingUser.password_hash);
            if (!isPasswordCorrect) {
                throw new Error('An account with this email already exists. Please login or use the correct password.');
            }

            const existingBuyer = await client.query(
                'SELECT id FROM buyers WHERE user_id = $1 FOR UPDATE',
                [existingUser.id]
            );
            if (existingBuyer.rows[0]) {
                throw new Error('A buyer account with this email already exists.');
            }

            const buyer = await Buyer.create({
                fullName,
                email: normalizedEmail,
                mobilePayment: mobile_payment,
                whatsappNumber: whatsapp_number,
                city,
                location,
                userId: existingUser.id,
                termsAccepted
            }, client);

            await ensureRole(client, existingUser.id, 'buyer');
            await client.query('COMMIT');
            await invalidateCrossRoleCache(existingUser.id);
            return buyer;
        } catch (error) {
            await client.query('ROLLBACK').catch(rollbackError =>
                logger.error('[PROFILE_PROVISIONING] Buyer rollback failed:', rollbackError)
            );
            throw error;
        } finally {
            client.release();
        }
    }

    static async createSellerProfileForExistingUser(data) {
        const {
            fullName,
            shopName,
            email,
            phone,
            whatsappNumber,
            password,
            city,
            location,
            physicalAddress,
            latitude,
            longitude,
            termsAccepted
        } = data;
        const normalizedEmail = (email || '').trim().toLowerCase();
        const whatsapp_number = whatsappNumber || phone;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const existingUserResult = await client.query(
                'SELECT id, email, password_hash FROM users WHERE LOWER(email) = $1 FOR UPDATE',
                [normalizedEmail]
            );
            const existingUser = existingUserResult.rows[0];
            if (!existingUser) {
                throw identityRequiredError(normalizedEmail, 'seller');
            }

            requirePassword(password);
            const isPasswordCorrect = await User.verifyPassword(password, existingUser.password_hash);
            if (!isPasswordCorrect) {
                throw new Error('An account with this email already exists. Please login or use the correct password.');
            }

            const existingSeller = await client.query(
                'SELECT id FROM sellers WHERE user_id = $1 FOR UPDATE',
                [existingUser.id]
            );
            if (existingSeller.rows[0]) {
                throw new Error('A seller account with this email already exists.');
            }

            const seller = await SellerModel.createSeller({
                fullName,
                shopName,
                email: normalizedEmail,
                whatsappNumber: whatsapp_number,
                city,
                location,
                physicalAddress,
                latitude,
                longitude,
                userId: existingUser.id,
                termsAccepted
            }, client);

            await ensureRole(client, existingUser.id, 'seller');
            await client.query('COMMIT');
            await invalidateCrossRoleCache(existingUser.id);
            return seller;
        } catch (error) {
            await client.query('ROLLBACK').catch(rollbackError =>
                logger.error('[PROFILE_PROVISIONING] Seller rollback failed:', rollbackError)
            );
            throw error;
        } finally {
            client.release();
        }
    }
}

export default ProfileProvisioningService;
