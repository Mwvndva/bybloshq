import { BaseRepository } from './BaseRepository.js';
import { toCamelCase } from '../../utils/caseUtils.js';

export class BuyerRepository extends BaseRepository {
    constructor(db) {
        super('buyers', db);
    }

    async create(data, client = this.db) {
        const {
            fullName, email, mobilePayment, whatsappNumber, city, location,
            latitude, longitude, fullAddress, userId = null, termsAccepted = false
        } = data;

        const query = `
      INSERT INTO buyers (
        full_name, email, mobile_payment, whatsapp_number, 
        city, location, latitude, longitude, full_address, user_id, 
        terms_accepted, terms_accepted_at,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $11 = true THEN NOW() ELSE NULL END, NOW(), NOW())
      RETURNING *
    `;
        const values = [
            fullName, email, mobilePayment, whatsappNumber,
            city, location, latitude, longitude, fullAddress, userId,
            termsAccepted
        ];
        const result = await client.query(query, values);
        return toCamelCase(result.rows[0]);
    }

    async findByEmail(email, client = this.db) {
        if (!email) return null;
        const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE LOWER(email) = $1';
        const result = await client.query(query, [email.toLowerCase()]);
        return toCamelCase(result.rows[0]);
    }

    async findByPhone(phone, client = this.db) {
        if (!phone) return null;
        let normalized = phone.toString().replace(/\D/g, '');

        const phoneVariations = new Set();
        phoneVariations.add(normalized);

        if (normalized.startsWith('0') && normalized.length === 10) {
            phoneVariations.add('+254' + normalized.substring(1));
            phoneVariations.add('254' + normalized.substring(1));
        } else if (normalized.startsWith('254') && normalized.length === 12) {
            phoneVariations.add('+' + normalized);
            phoneVariations.add('0' + normalized.substring(3));
        } else if (normalized.length === 9) {
            phoneVariations.add('0' + normalized);
            phoneVariations.add('+254' + normalized);
            phoneVariations.add('254' + normalized);
        }

        const query = `
      SELECT *, user_id AS "userId" 
      FROM buyers 
      WHERE mobile_payment = ANY($1) 
      OR whatsapp_number = ANY($1)
      LIMIT 1
    `;
        const result = await client.query(query, [Array.from(phoneVariations)]);
        return toCamelCase(result.rows[0]);
    }

    async findByUserId(userId, client = this.db) {
        const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE user_id = $1';
        const result = await client.query(query, [userId]);
        return toCamelCase(result.rows[0]);
    }

    async update(id, updateData, client = this.db) {
        const fields = [];
        const values = [];
        let paramIndex = 1;

        const fieldMap = {
            fullName: 'full_name',
            mobilePayment: 'mobile_payment',
            whatsappNumber: 'whatsapp_number',
            city: 'city',
            location: 'location',
            latitude: 'latitude',
            longitude: 'longitude',
            fullAddress: 'full_address',
            isVerified: 'is_verified'
        };

        for (const [key, value] of Object.entries(updateData)) {
            if (key === 'password') continue;
            const dbField = fieldMap[key] || key;
            fields.push(`${dbField} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }

        fields.push('updated_at = NOW()');

        if (fields.length === 0) return null;

        const query = `
      UPDATE buyers 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

        values.push(id);
        const result = await client.query(query, values);
        return toCamelCase(result.rows[0]);
    }

    async updateLocation(buyerId, { latitude, longitude, fullAddress }, client = this.db) {
        const query = `
      UPDATE buyers 
      SET latitude = $1, longitude = $2, full_address = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
        const result = await client.query(query, [latitude, longitude, fullAddress, buyerId]);
        return toCamelCase(result.rows[0]);
    }

    async incrementRefunds(buyerId, amount, client = this.db) {
        const query = `
      UPDATE buyers 
      SET refunds = COALESCE(refunds, 0) + $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
        const result = await client.query(query, [amount, buyerId]);
        return toCamelCase(result.rows[0]);
    }
}
