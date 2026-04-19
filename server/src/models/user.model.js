import { pool } from '../config/database.js';
import bcrypt from 'bcrypt';

class User {
    /**
     * Find user by email
     * @param {string} email 
     * @returns {Promise<Object|null>}
     */
    static async findByEmail(email) {
        if (!email) return null;
        // PERF-06: select only needed columns
        const query = 'SELECT id, email, password_hash, role, is_verified FROM users WHERE LOWER(email) = $1';
        const result = await pool.query(query, [email.toLowerCase()]);
        return result.rows[0] || null;
    }

    static async findByEmailForUpdate(client, email) {
        const query = 'SELECT id, email, password_hash, role, is_verified FROM users WHERE LOWER(email) = $1 FOR UPDATE';
        const result = await client.query(query, [email.toLowerCase()]);
        return result.rows[0] || null;
    }

    /**
     * Find user by ID
     * @param {number} id 
     * @returns {Promise<Object|null>}
     */
    static async findById(id) {
        if (!id) return null;
        const query = 'SELECT id, email, role, is_verified FROM users WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Create a new user
     * @param {Object} userData 
     * @returns {Promise<Object>}
     */
    static async create({ email, password, role, is_verified = false }, externalClient = null) {
        const hashedPassword = await bcrypt.hash(password, 12);
        const client = externalClient || await pool.connect();
        const shouldManageTransaction = !externalClient;
        try {
            if (shouldManageTransaction) await client.query('BEGIN');

            const userQuery = `
                INSERT INTO users (email, password_hash, role, is_verified, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                RETURNING id, email, role, is_verified, created_at, updated_at
            `;

            const userResult = await client.query(userQuery, [
                email.toLowerCase(),
                hashedPassword,
                role,
                is_verified
            ]);

            const newUser = userResult.rows[0];

            // Assign role in user_roles table
            if (role) {
                const roleResult = await client.query('SELECT id FROM roles WHERE slug = $1', [role]);
                if (roleResult.rows[0]) {
                    const roleId = roleResult.rows[0].id;
                    await client.query(
                        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [newUser.id, roleId]
                    );
                }
            }

            if (shouldManageTransaction) await client.query('COMMIT');
            return newUser;
        } catch (error) {
            if (shouldManageTransaction) await client.query('ROLLBACK');
            throw error;
        } finally {
            if (shouldManageTransaction) client.release();
        }
    }

    /**
     * Verify password
     * @param {string} candidatePassword 
     * @param {string} hashedPassword 
     * @returns {Promise<boolean>}
     */
    static async verifyPassword(candidatePassword, hashedPassword) {
        return await bcrypt.compare(candidatePassword, hashedPassword);
    }

    /**
     * Update last login timestamp
     * @param {number} userId 
     */
    static async updateLastLogin(userId) {
        const query = 'UPDATE users SET last_login = NOW() WHERE id = $1';
        await pool.query(query, [userId]);
    }

    /**
     * Set password reset token
     * @param {string} email 
     * @param {string} token 
     * @param {Date} expires 
     */
    static async setPasswordResetToken(email, token, expires) {
        const query = `
      UPDATE users 
      SET reset_password_token = $1, reset_password_expires = $2, updated_at = NOW()
      WHERE email = $3
      RETURNING id, email, role
    `;
        const result = await pool.query(query, [token, expires, email.toLowerCase()]);
        return result.rows[0] || null;
    }

    /**
     * Verify password reset token
     * @param {string} email 
     * @param {string} token 
     * @returns {Promise<boolean>}
     */
    static async verifyPasswordResetToken(email, token) {
        const query = `
      SELECT * FROM users 
      WHERE email = $1 
      AND reset_password_token = $2 
      AND reset_password_expires > NOW()
    `;
        const result = await pool.query(query, [email.toLowerCase(), token]);
        return result.rows.length > 0;
    }

    /**
     * Store a hashed email verification token for a user
     * @param {string} email
     * @param {string} hashedToken - SHA-256 hash of the raw token
     * @param {Date} expires - expiry timestamp
     */
    static async setEmailVerificationToken(email, hashedToken, expires) {
        const query = `
      UPDATE users
      SET email_verification_token = $1,
          email_verification_expires = $2,
          updated_at = NOW()
      WHERE email = $3
      RETURNING id, email
    `
        const result = await pool.query(query, [hashedToken, expires, email.toLowerCase()])
        return result.rows[0] || null
    }

    /**
     * Verify an email verification token. Returns the user if valid, null if not.
     * @param {string} email
     * @param {string} hashedToken - SHA-256 hash of the raw token
     * @returns {Promise<Object|null>}
     */
    static async verifyEmailToken(email, hashedToken) {
        const query = `
      SELECT id, email, role, is_verified
      FROM users
      WHERE LOWER(email) = $1
        AND email_verification_token = $2
        AND email_verification_expires > NOW()
    `
        const result = await pool.query(query, [email.toLowerCase(), hashedToken])
        return result.rows[0] || null
    }

    /**
     * Mark user email as verified and clear the verification token (single-use)
     * @param {string} email
     */
    static async markEmailVerified(email) {
        const query = `
      UPDATE users
      SET is_verified = true,
          email_verification_token = NULL,
          email_verification_expires = NULL,
          updated_at = NOW()
      WHERE LOWER(email) = $1
      RETURNING id, email, role, is_verified
    `
        const result = await pool.query(query, [email.toLowerCase()])
        return result.rows[0] || null
    }

    /**
     * Update password for a logged in user
     * @param {number} userId 
     * @param {string} newPassword 
     */
    static async updatePassword(userId, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        const query = `
      UPDATE users 
      SET password_hash = $1, 
          password_changed_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, role
    `;

        const result = await pool.query(query, [hashedPassword, userId]);
        return result.rows[0] || null;
    }

    /**
     * Reset password
     * @param {string} email 
     * @param {string} newPassword 
     */
    static async resetPassword(email, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        const query = `
      UPDATE users 
      SET password_hash = $1, 
          reset_password_token = NULL, 
          reset_password_expires = NULL,
          password_changed_at = NOW(),
          updated_at = NOW()
      WHERE email = $2
      RETURNING id, email, role
    `;

        const result = await pool.query(query, [hashedPassword, email.toLowerCase()]);
        return result.rows[0] || null;
    }

    static async linkRole(client, userId, roleSlug) {
        const executor = client || pool;
        const roleResult = await executor.query('SELECT id FROM roles WHERE slug = $1', [roleSlug]);
        if (roleResult.rows[0]) {
            await executor.query(
                'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [userId, roleResult.rows[0].id]
            );
        }
    }

    static async findByIdWithProfile(id, role) {
        let query;
        switch (role) {
            case 'admin':
                query = `
                    SELECT u.*, u.id as profile_id
                    FROM users u 
                    WHERE u.id = $1 AND u.role = 'admin' AND u.is_active = true
                `;
                break;
            case 'buyer':
                query = `
                    SELECT
                        u.id as user_table_id, u.email, u.role, u.is_verified, u.is_active, u.password_changed_at,
                        b.id as profile_id, b.full_name, b.whatsapp_number,
                        COALESCE(b.status, 'active') as status
                    FROM users u
                    LEFT JOIN buyers b ON u.id = b.user_id
                    WHERE u.id = $1
                        AND (b.status = 'active' OR b.status IS NULL OR b.id IS NULL)
                `;
                break;
            case 'seller':
                query = `
                    SELECT 
                        u.id as user_table_id, u.email, u.role, u.is_verified, u.is_active, u.password_changed_at,
                        s.id as profile_id, s.full_name, s.shop_name, s.whatsapp_number, s.city, s.location, s.balance, s.total_sales, s.client_count, s.status, s.referral_code, s.total_referral_earnings
                    FROM users u 
                    LEFT JOIN sellers s ON u.id = s.user_id 
                    WHERE u.id = $1
                `;
                break;
            default:
                return null;
        }

        const { rows } = await pool.query(query, [id]);
        return rows[0] || null;
    }

    static async findCrossRoles(id) {
        const query = `
            SELECT 
                (SELECT id FROM buyers WHERE user_id = $1 AND status = 'active' LIMIT 1) as buyer_id,
                (SELECT id FROM sellers WHERE user_id = $1 LIMIT 1) as seller_id
        `;
        const { rows } = await pool.query(query, [id]);
        return rows[0] || { buyer_id: null, seller_id: null };
    }

    static async delete(client, id) {
        const query = 'DELETE FROM users WHERE id = $1';
        const executor = client || pool;
        await executor.query(query, [id]);
    }
}

export default User;
