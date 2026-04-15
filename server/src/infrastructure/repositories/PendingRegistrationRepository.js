import { pool } from '../db/pool.js';
import { toCamelCase } from '../../utils/caseUtils.js';

export class PendingRegistrationRepository {
    constructor(db = pool) {
        this.db = db;
    }

    async create(data, client = this.db) {
        const {
            email, passwordHash, role, registrationData, physicalAddress = null,
            latitude = null, longitude = null, verificationToken, expiresAt,
            termsAccepted = false
        } = data;

        const query = `
      INSERT INTO pending_registrations (
        email, password_hash, role, registration_data, 
        physical_address, latitude, longitude, verification_token, 
        expires_at, terms_accepted, terms_accepted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $10 = true THEN NOW() ELSE NULL END)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        registration_data = EXCLUDED.registration_data,
        physical_address = EXCLUDED.physical_address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        verification_token = EXCLUDED.verification_token,
        expires_at = EXCLUDED.expires_at,
        terms_accepted = EXCLUDED.terms_accepted,
        terms_accepted_at = EXCLUDED.terms_accepted_at,
        created_at = NOW()
      RETURNING *
    `;

        const result = await client.query(query, [
            email.toLowerCase(),
            passwordHash,
            role,
            registrationData,
            physicalAddress,
            latitude,
            longitude,
            verificationToken,
            expiresAt,
            termsAccepted
        ]);

        return toCamelCase(result.rows[0]);
    }

    async findByEmailAndToken(email, hashedToken, client = this.db) {
        const query = `
      SELECT * FROM pending_registrations 
      WHERE LOWER(email) = $1 
      AND verification_token = $2 
      AND expires_at > NOW()
    `;
        const result = await client.query(query, [email.toLowerCase(), hashedToken]);
        return toCamelCase(result.rows[0]);
    }

    async findByEmail(email, client = this.db) {
        const query = 'SELECT * FROM pending_registrations WHERE LOWER(email) = $1';
        const result = await client.query(query, [email.toLowerCase()]);
        return toCamelCase(result.rows[0]);
    }

    async deleteByEmail(email, client = this.db) {
        const query = 'DELETE FROM pending_registrations WHERE LOWER(email) = $1';
        await client.query(query, [email.toLowerCase()]);
    }

    async updateToken(email, newHashedToken, newExpiresAt, client = this.db) {
        const query = `
      UPDATE pending_registrations
      SET verification_token = $1,
          expires_at = $2
      WHERE LOWER(email) = $3
      RETURNING id, email, role
    `;
        const result = await client.query(query, [newHashedToken, newExpiresAt, email.toLowerCase()]);
        return toCamelCase(result.rows[0]);
    }
}
