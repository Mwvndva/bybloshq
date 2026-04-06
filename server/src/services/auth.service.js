import crypto from 'crypto';
import bcrypt from 'bcrypt';
import logger from '../utils/logger.js';
import User from '../models/user.model.js';
import BuyerService from './buyer.service.js';
import SellerService from './seller.service.js';
import * as SellerModel from '../models/seller.model.js';
import Buyer from '../models/buyer.model.js';
import { signToken } from '../utils/jwt.js';
import { sendPasswordResetEmail } from '../utils/email.js';
import { pool } from '../config/database.js';
import PendingRegistration from '../models/pendingRegistration.model.js';

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

        // Check email verification
        // Sellers must verify before accessing the platform
        // Buyers get a softer check — they can still purchase (for guest checkout compat)
        if (!user.is_verified) {
            const err = new Error('Please verify your email before logging in. Check your inbox or request a new verification link.');
            err.statusCode = 403;
            err.code = 'EMAIL_NOT_VERIFIED';
            err.email = user.email;
            err.userType = type || user.role;
            throw err;
        }

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
        const { email, password } = data;
        const normalizedEmail = (email || '').trim().toLowerCase();

        // TEMPORARY DEBUG LOGGING
        try {
            const fs = await import('fs');
            const logMsg = `\n[${new Date().toISOString()}] REGISTER ATTEMPT: email=${normalizedEmail} type=${type}\n`;
            fs.appendFileSync('c:/Users/Administrator/Downloads/bybloshq/server/register_debug.log', logMsg);
        } catch (e) { }

        // 1. Check if user already exists in unified users table
        const existingUser = await User.findByEmail(normalizedEmail);

        try {
            const fs = await import('fs');
            const logMsg = `[${new Date().toISOString()}] DB CHECK: email=${normalizedEmail} found=${!!existingUser} id=${existingUser?.id} verified=${existingUser?.is_verified}\n`;
            fs.appendFileSync('c:/Users/Administrator/Downloads/bybloshq/server/register_debug.log', logMsg);
        } catch (e) { }

        if (existingUser) {
            // Already a user - check if they already have this profile type
            switch (type) {
                case 'seller': {
                    const existingSeller = await SellerModel.findSellerByUserId(existingUser.id);
                    if (existingSeller) throw new Error('A seller account with this email already exists.');

                    // Add seller profile to existing user
                    const seller = await SellerService.register(data);
                    return { status: 'created', user: seller };
                }
                case 'buyer': {
                    const existingBuyer = await Buyer.findByUserId(existingUser.id);
                    if (existingBuyer) throw new Error('A buyer account with this email already exists.');

                    // Add buyer profile to existing user
                    const buyer = await BuyerService.register(data);
                    return { status: 'created', user: buyer };
                }
                default:
                    throw new Error('Invalid registration type');
            }
        }

        // 2. NEW USER: Store in pending_registrations
        const passwordHash = await bcrypt.hash(password, 12);
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresHours = Number.parseInt(process.env.EMAIL_VERIFICATION_EXPIRES_HOURS || '24', 10);
        const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

        // Remove sensitive fields from registration_data
        const registrationData = { ...data };
        delete registrationData.password;
        delete registrationData.confirmPassword;

        await PendingRegistration.create({
            email: normalizedEmail,
            passwordHash,
            role: type,
            registrationData,
            verificationToken: hashedToken,
            expiresAt
        });

        // 3. Send verification email
        const { sendVerificationEmail } = await import('../utils/email.js');
        await sendVerificationEmail(normalizedEmail, rawToken, type);

        return { status: 'pending_verification', email: normalizedEmail };
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

    /**
     * Generate a verification token and send the verification email.
     * Called AFTER successful registration.
     * @param {string} email
     * @param {string} userType - 'buyer' | 'seller'
     */
    static async sendEmailVerification(email, userType) {
        const rawToken = crypto.randomBytes(32).toString('hex')
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
        const expiresHours = Number.parseInt(process.env.EMAIL_VERIFICATION_EXPIRES_HOURS || '24', 10)
        const expires = new Date(Date.now() + expiresHours * 60 * 60 * 1000)

        await User.setEmailVerificationToken(email, hashedToken, expires)

        // Send raw token in the email link — backend hashes it on verification
        const { sendVerificationEmail } = await import('../utils/email.js')
        await sendVerificationEmail(email, rawToken, userType)

        return true
    }

    /**
     * Verify an email using the token from the verification link
     * @param {string} email
     * @param {string} rawToken - the raw token from the email link (will be hashed internally)
     * @returns {Promise<Object>} the verified user
     */
    static async verifyEmail(email, rawToken) {
        if (!email || !rawToken) {
            throw new Error('Email and token are required');
        }

        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        // 1. Check if user already exists in users table (existing verification flow)
        const user = await User.verifyEmailToken(email, hashedToken);

        if (user) {
            if (user.is_verified) {
                return { alreadyVerified: true, user };
            }
            const verifiedUser = await User.markEmailVerified(email);
            return { alreadyVerified: false, user: verifiedUser };
        }

        // 2. Check pending_registrations
        const pending = await PendingRegistration.findByEmailAndToken(email, hashedToken);
        if (!pending) {
            throw new Error('Verification link is invalid or has expired. Please request a new one.');
        }

        // 3. Create account from pending data
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // a. Create base user record
            // Use internal password hash from pending (no need to re-hash)
            const userQuery = `
                INSERT INTO users (email, password_hash, role, is_verified, created_at, updated_at)
                VALUES ($1, $2, $3, true, NOW(), NOW())
                RETURNING id, email, role, is_verified
            `;
            const userResult = await client.query(userQuery, [
                pending.email.toLowerCase(),
                pending.password_hash,
                pending.role
            ]);
            const newUser = userResult.rows[0];

            // Assign role
            const roleResult = await client.query('SELECT id FROM roles WHERE slug = $1', [pending.role]);
            if (roleResult.rows[0]) {
                await client.query(
                    'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [newUser.id, roleResult.rows[0].id]
                );
            }

            // b. Create profile based on role
            const profileData = { ...pending.registration_data, userId: newUser.id };
            let profile = null;

            if (pending.role === 'seller') {
                profile = await SellerModel.createSeller(profileData, client);
            } else if (pending.role === 'buyer') {
                profile = await Buyer.create(profileData, client);

                // --- LATE BINDING OF ORDERS ---
                // Search for any orders made with this email while it was pending and associate them
                // This ensures checkout flow continues seamlessly for unregistered buyers
                const linkResult = await client.query(
                    'UPDATE product_orders SET buyer_id = $1 WHERE LOWER(buyer_email) = $2 AND buyer_id IS NULL',
                    [profile.id, pending.email.toLowerCase()]
                );

                if (linkResult.rowCount > 0) {
                    console.log(`[AUTH] Linked ${linkResult.rowCount} previous guest orders for new buyer: ${pending.email}`);
                    logger.info(`[AUTH] Linked ${linkResult.rowCount} previous guest orders for new buyer: ${pending.email}`, {
                        buyerId: profile.id,
                        email: pending.email
                    });
                }
            }

            // c. Delete from pending
            await client.query('DELETE FROM pending_registrations WHERE email = $1', [pending.email]);

            await client.query('COMMIT');

            return { alreadyVerified: false, user: newUser, profile };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[AUTH] Failed to create account from verification:', error);
            throw new Error('An error occurred during account creation. Please try again.');
        } finally {
            client.release();
        }
    }

    /**
     * Resend a verification email.
     * Rate-limited by the calling route.
     * @param {string} email
     * @param {string} userType - 'buyer' | 'seller'
     */
    static async resendVerificationEmail(email, userType) {
        const normalizedEmail = email.toLowerCase();
        const user = await User.findByEmail(normalizedEmail);

        if (user) {
            if (user.is_verified) return true;
            await AuthService.sendEmailVerification(normalizedEmail, userType);
            return true;
        }

        // Check pending_registrations
        const pending = await PendingRegistration.findByEmail(normalizedEmail);
        if (pending) {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresHours = Number.parseInt(process.env.EMAIL_VERIFICATION_EXPIRES_HOURS || '24', 10);
            const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

            await PendingRegistration.create({
                ...pending,
                passwordHash: pending.password_hash,
                registrationData: pending.registration_data,
                verificationToken: hashedToken,
                expiresAt
            });

            const { sendVerificationEmail } = await import('../utils/email.js');
            await sendVerificationEmail(normalizedEmail, rawToken, userType);
        }

        return true;
    }
}

export default AuthService;