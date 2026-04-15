import { BaseRepository } from './BaseRepository.js';
import bcrypt from 'bcrypt';
import { toCamelCase } from '../../utils/caseUtils.js';

export class UserRepository extends BaseRepository {
    constructor(db) {
        super('users', db);
    }

    async findByEmail(email, client = this.db) {
        if (!email) return null;
        const query = 'SELECT * FROM users WHERE LOWER(email) = $1';
        const result = await client.query(query, [email.toLowerCase()]);
        return toCamelCase(result.rows[0]);
    }

    async create({ email, password, role, is_verified = false }, client = this.db) {
        const hashedPassword = await bcrypt.hash(password, 12);
        const userQuery = `
      INSERT INTO users (email, password_hash, role, is_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, email, role, is_verified, created_at, updated_at
    `;

        const result = await client.query(userQuery, [
            email.toLowerCase(),
            hashedPassword,
            role,
            is_verified
        ]);

        const newUser = result.rows[0];

        if (role) {
            const roleResult = await client.query('SELECT id FROM roles WHERE slug = $1', [role]);
            if (roleResult.rows[0]) {
                await client.query(
                    'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [newUser.id, roleResult.rows[0].id]
                );
            }
        }

        return newUser;
    }

    async updateLastLogin(userId, client = this.db) {
        const query = 'UPDATE users SET last_login = NOW() WHERE id = $1';
        await client.query(query, [userId]);
    }

    async setPasswordResetToken(email, token, expires, client = this.db) {
        const query = `
      UPDATE users 
      SET reset_password_token = $1, reset_password_expires = $2, updated_at = NOW()
      WHERE email = $3
      RETURNING id, email, role
    `;
        const result = await client.query(query, [token, expires, email.toLowerCase()]);
        return result.rows[0] || null;
    }

    async verifyPasswordResetToken(email, token, client = this.db) {
        const query = `
      SELECT * FROM users 
      WHERE email = $1 
      AND reset_password_token = $2 
      AND reset_password_expires > NOW()
    `;
        const result = await client.query(query, [email.toLowerCase(), token]);
        return result.rows.length > 0;
    }

    async setEmailVerificationToken(email, hashedToken, expires, client = this.db) {
        const query = `
      UPDATE users
      SET email_verification_token = $1,
          email_verification_expires = $2,
          updated_at = NOW()
      WHERE email = $3
      RETURNING id, email
    `;
        const result = await client.query(query, [hashedToken, expires, email.toLowerCase()]);
        return result.rows[0] || null;
    }

    async verifyEmailToken(email, hashedToken, client = this.db) {
        const query = `
      SELECT id, email, role, is_verified
      FROM users
      WHERE LOWER(email) = $1
        AND email_verification_token = $2
        AND email_verification_expires > NOW()
    `;
        const result = await client.query(query, [email.toLowerCase(), hashedToken]);
        return result.rows[0] || null;
    }

    async markEmailVerified(email, client = this.db) {
        const query = `
      UPDATE users
      SET is_verified = true,
          email_verification_token = NULL,
          email_verification_expires = NULL,
          updated_at = NOW()
      WHERE LOWER(email) = $1
      RETURNING id, email, role, is_verified
    `;
        const result = await client.query(query, [email.toLowerCase()]);
        return result.rows[0] || null;
    }

    async updatePassword(userId, hashedPassword, client = this.db) {
        const query = `
      UPDATE users 
      SET password_hash = $1, 
          password_changed_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, role
    `;
        const result = await client.query(query, [hashedPassword, userId]);
        return result.rows[0] || null;
    }

    async resetPassword(email, hashedPassword, client = this.db) {
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
        const result = await client.query(query, [hashedPassword, email.toLowerCase()]);
        return result.rows[0] || null;
    }

    async findByUserIdWithLock(email, client = this.db) {
        const query = 'SELECT * FROM users WHERE LOWER(email) = $1 FOR UPDATE';
        const result = await client.query(query, [email.toLowerCase()]);
        return toCamelCase(result.rows[0]);
    }

    async addRole(userId, role, client = this.db) {
        const roleResult = await client.query('SELECT id FROM roles WHERE slug = $1', [role]);
        if (roleResult.rows[0]) {
            await client.query(
                'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [userId, roleResult.rows[0].id]
            );
        }
    }
}
