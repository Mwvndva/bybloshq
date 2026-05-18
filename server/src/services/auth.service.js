import crypto from 'crypto';
import bcrypt from 'bcrypt';
import logger from '../shared/utils/logger.js';
import User from '../models/user.model.js';
import * as SellerModel from '../models/seller.model.js';
import Buyer from '../models/buyer.model.js';
import { signToken } from '../shared/utils/jwt.js';
import { sendPasswordResetEmail } from '../shared/utils/email.js';
import { pool } from '../shared/db/database.js';
import PendingRegistration from '../models/pendingRegistration.model.js';
import ReferralService from './referral.service.js';
import ProfileProvisioningService from './profileProvisioning.service.js';

// FIXED BUG-AUTH-02: cost factor must match bcrypt.hash(password, 12) used in user.model.js
// Regenerate with: node -e "const b=require('bcrypt');b.hash('__timing_dummy__',12).then(console.log)"
const TIMING_DUMMY_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TgxO7dCVS0VxMhUv8E1Y2d6PJHRW';

class AuthService {
    /**
     * Unified login method
     * @param {string} email 
     * @param {string} password 
     * @param {string} type - Optional portal type: 'buyer' | 'seller' | 'admin'
     */
    static async login(email, password, type = null) {
        const normalizedEmail = email.toLowerCase().trim();
        let target = await User.findByEmail(normalizedEmail);
        let isPending = false;

        if (!target) {
            target = await PendingRegistration.findByEmail(normalizedEmail);
            isPending = !!target;
        }

        // Anti-Enumeration: Always run bcrypt.compare to prevent timing attacks.
        // Use a pre-computed dummy hash if the email doesn't exist in either table.
        const hashToCompare = target ? (target.password_hash || target.password) : TIMING_DUMMY_HASH;
        const isMatch = await bcrypt.compare(password, hashToCompare);

        if (!target || !isMatch) {
            // Timing-safe: we spent the same amount of CPU time regardless of email existence.
            return null;
        }

        // --- At this point, the password is correct ---

        if (isPending) {
            // Regeneration of verification token logic (same as before)
            const rawToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresHours = Number.parseInt(process.env.EMAIL_VERIFICATION_EXPIRES_HOURS || '24', 10);
            const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

            await PendingRegistration.updateToken(normalizedEmail, hashedToken, expiresAt);

            const { sendVerificationEmail } = await import('../shared/utils/email.js');
            sendVerificationEmail(normalizedEmail, rawToken, target.role).catch(err =>
                logger.error('[AUTH] Failed to resend pending verification email:', err.message)
            );

            logger.info(`[AUTH] Login attempted for pending user, resent verification email: ${normalizedEmail}`);

            const err = new Error(
                "Your account is not yet verified. We've sent a new verification link to your email. Please check your inbox."
            );
            err.code = 'PENDING_VERIFICATION';
            err.statusCode = 403;
            err.email = normalizedEmail;
            err.userType = target.role;
            throw err;
        }

        // Renamed 'user' to 'target' for clarity, let's keep 'user' for later logic
        const user = target;

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

        // NEW: Check terms acceptance (Task 10)
        let termsAccepted = true;
        if (user.role === 'seller') {
            const profile = await SellerModel.findSellerByUserId(user.id);
            termsAccepted = profile ? profile.terms_accepted : true;
        } else if (user.role === 'buyer') {
            const profile = await Buyer.findByUserId(user.id);
            termsAccepted = profile ? profile.terms_accepted : true;
        }

        if (termsAccepted === false) {
            // Treat unaccepted terms as a verification blocker for login
            // 1. Resend verification email (standard procedure)
            await AuthService.resendVerificationEmail(user.email, type || user.role);

            // 2. Throw specific error for frontend redirection
            const err = new Error('Please accept the terms and conditions and verify your account.');
            err.statusCode = 403;
            err.code = 'TERMS_NOT_ACCEPTED';
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
            case 'creator': {
                const creatorResult = await pool.query(
                    `SELECT * FROM creators WHERE user_id = $1 AND status = 'active' LIMIT 1`,
                    [user.id]
                );
                profile = creatorResult.rows[0] || null;
                break;
            }
            case 'marketing':
                // Special check for marketing admin email if defined in env
                const MARKETING_EMAIL = process.env.MARKETING_EMAIL || 'adminmarketing@bybloshq.space';
                if (user.role === 'marketing' && user.email.toLowerCase() === MARKETING_EMAIL.toLowerCase()) {
                    profile = { id: user.id, email: user.email, role: 'marketing' };
                }
                break;
        }

        if (!profile && targetType !== 'admin') return null;

        const token = signToken(user.id, targetType, user.email);
        return { user, profile, token };
    }

    /**
     * Register delegation
     * @param {Object} data 
     * @param {string} type 
     */
    static async register(data, type) {
        const { email, password, termsAccepted } = data;
        const normalizedEmail = (email || '').trim().toLowerCase();

        // 0. Validate terms acceptance
        if (termsAccepted !== true) {
            throw new Error('You must accept the terms and conditions to create an account.');
        }

        // 1. Check if user already exists in unified users table
        const existingUser = await User.findByEmail(normalizedEmail);

        if (existingUser) {
            // Already a user - check if they are verified
            if (!existingUser.is_verified) {
                // Trigger verification resend and return pending status
                await AuthService.resendVerificationEmail(normalizedEmail, type);
                return { status: 'pending_verification', email: normalizedEmail };
            }

            // Already a verified user - check if they already have this profile type
            switch (type) {
                case 'seller': {
                    const seller = await ProfileProvisioningService.createSellerProfileForExistingUser({
                        ...data,
                        email: normalizedEmail,
                        termsAccepted
                    });
                    return { status: 'created', user: seller };
                }
                case 'buyer': {
                    const buyer = await ProfileProvisioningService.createBuyerProfileForExistingUser({
                        ...data,
                        email: normalizedEmail,
                        termsAccepted
                    });
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
            physicalAddress: data.physicalAddress,
            latitude: data.latitude,
            longitude: data.longitude,
            verificationToken: hashedToken,
            expiresAt,
            termsAccepted: true // We already validated it above
        });

        // 3. Send verification email
        const { sendVerificationEmail } = await import('../shared/utils/email.js');
        await sendVerificationEmail(normalizedEmail, rawToken, type);

        return { status: 'pending_verification', email: normalizedEmail };
    }

    static async registerGuestBuyer(data) {
        const effectivePassword = data.password || crypto.randomBytes(16).toString('hex');

        return AuthService.register({
            ...data,
            password: effectivePassword,
            location: data.location || data.city || 'Not specified',
            termsAccepted: data.termsAccepted !== undefined ? data.termsAccepted : true
        }, 'buyer');
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
        const { sendVerificationEmail } = await import('../shared/utils/email.js')
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
            logger.warn(`[AUTH] Verification failed - record not found for email: ${email} with hashed token: ${hashedToken}`);
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
            // Handle potentially nested registrationData (FIX-19)
            const rawRegData = pending.registration_data || {};
            const regData = rawRegData.registrationData || rawRegData;

            // FIXED BUG-EMAIL-01: explicitly whitelist fields — do NOT spread untrusted regData
            const profileData = {
                fullName: regData.fullName || regData.full_name || regData.name,
                email: pending.email,
                mobilePayment: regData.mobilePayment || regData.mobile_payment || regData.phone,
                whatsappNumber: regData.whatsappNumber || regData.whatsapp_number || regData.phone,
                shopName: regData.shopName || regData.shop_name,
                city: regData.city,
                location: regData.location || regData.city || 'Not specified',
                physicalAddress: pending.physical_address || regData.physicalAddress || regData.physical_address,
                latitude: pending.latitude !== null && pending.latitude !== undefined ? Number(pending.latitude) : (regData.latitude ? Number(regData.latitude) : null),
                longitude: pending.longitude !== null && pending.longitude !== undefined ? Number(pending.longitude) : (regData.longitude ? Number(regData.longitude) : null),
                userId: newUser.id,
                termsAccepted: pending.terms_accepted !== undefined ? pending.terms_accepted : true,
                referralCode: regData.referralCode || regData.referral_code || null
            };
            let profile = null;

            if (pending.role === 'seller') {
                profile = await SellerModel.createSeller(profileData, client);
                if (profileData.referralCode && profile?.id) {
                    await ReferralService.applyReferral(profile.id, profileData.referralCode, client);
                }
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

            // Explicit mapping to prevent data loss and fix termsAccepted bug
            const registrationData = pending.registration_data || {};

            await PendingRegistration.create({
                email: normalizedEmail,
                passwordHash: pending.password_hash,
                role: pending.role,
                registrationData: registrationData.registrationData || registrationData,
                physicalAddress: pending.physical_address,
                latitude: pending.latitude,
                longitude: pending.longitude,
                verificationToken: hashedToken,
                expiresAt,
                termsAccepted: pending.terms_accepted
            });

            // Use the original role from registration for the link to ensure consistency
            const linkRole = pending.role || userType;
            const { sendVerificationEmail } = await import('../shared/utils/email.js');
            await sendVerificationEmail(normalizedEmail, rawToken, linkRole);
        }

        return true;
    }
}

export default AuthService;


