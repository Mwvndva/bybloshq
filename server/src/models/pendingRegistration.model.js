import { pool } from '../config/database.js';

class PendingRegistration {
    /**
     * Create a new pending registration
     * @param {Object} param0 
     * @returns {Promise<Object>}
     */
    static async create({ email, passwordHash, role, registrationData, verificationToken, expiresAt }) {
        const query = `
            INSERT INTO pending_registrations (email, password_hash, role, registration_data, verification_token, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                registration_data = EXCLUDED.registration_data,
                verification_token = EXCLUDED.verification_token,
                expires_at = EXCLUDED.expires_at,
                created_at = NOW()
            RETURNING *
        `;

        const result = await pool.query(query, [
            email.toLowerCase(),
            passwordHash,
            role,
            registrationData,
            verificationToken,
            expiresAt
        ]);

        return result.rows[0];
    }

    /**
     * Find a pending registration by email and token
     * @param {string} email 
     * @param {string} hashedToken 
     * @returns {Promise<Object|null>}
     */
    static async findByEmailAndToken(email, hashedToken) {
        const query = `
            SELECT * FROM pending_registrations 
            WHERE LOWER(email) = $1 
            AND verification_token = $2 
            AND expires_at > NOW()
        `;

        const result = await pool.query(query, [email.toLowerCase(), hashedToken]);
        return result.rows[0] || null;
    }

    /**
     * Delete a pending registration by email
     * @param {string} email 
     */
    static async deleteByEmail(email) {
        const query = 'DELETE FROM pending_registrations WHERE LOWER(email) = $1';
        await pool.query(query, [email.toLowerCase()]);
    }

    /**
     * Find by email (to check if already pending)
     * @param {string} email 
     */
    static async findByEmail(email) {
        const query = 'SELECT * FROM pending_registrations WHERE LOWER(email) = $1';
        const result = await pool.query(query, [email.toLowerCase()]);
        return result.rows[0] || null;
    }

    /**
     * Regenerate the verification token for a pending registration.
     * Called when user tries to login before verifying — sends a fresh link.
     * @param {string} email
     * @param {string} newHashedToken - SHA-256 hash of new raw token
     * @param {Date} newExpiresAt
     * @returns {Promise<Object|null>}
     */
    static async updateToken(email, newHashedToken, newExpiresAt) {
        const query = `
            UPDATE pending_registrations
            SET verification_token = $1,
                expires_at = $2
            WHERE LOWER(email) = $3
            RETURNING id, email, role
        `;
        const result = await pool.query(query, [newHashedToken, newExpiresAt, email.toLowerCase()]);
        return result.rows[0] || null;
    }
}

export default PendingRegistration;
