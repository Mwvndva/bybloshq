import pool from '../config/database.js';
import bcrypt from 'bcrypt';

class User {
    /**
     * Find user by email
     * @param {string} email 
     * @returns {Promise<Object|null>}
     */
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await pool.query(query, [email.toLowerCase()]);
        return result.rows[0] || null;
    }

    /**
     * Find user by ID
     * @param {number} id 
     * @returns {Promise<Object|null>}
     */
    static async findById(id) {
        const query = 'SELECT * FROM users WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Create a new user
     * @param {Object} userData 
     * @returns {Promise<Object>}
     */
    static async create({ email, password, role, is_verified = false }) {
        const hashedPassword = await bcrypt.hash(password, 12);

        const query = `
      INSERT INTO users (email, password_hash, role, is_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, email, role, is_verified, created_at, updated_at
    `;

        const result = await pool.query(query, [
            email.toLowerCase(),
            hashedPassword,
            role,
            is_verified
        ]);

        return result.rows[0];
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
          updated_at = NOW()
      WHERE email = $2
      RETURNING id, email, role
    `;

        const result = await pool.query(query, [hashedPassword, email.toLowerCase()]);
        return result.rows[0] || null;
    }
}

export default User;
