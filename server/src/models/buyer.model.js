import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/database.js';

// Convert snake_case to camelCase function
const toCamelCase = (obj) => {
  if (!obj) return null;
  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = value;
  }
  return newObj;
};

class Buyer {
  // Create a new buyer
  static async create({ fullName, email, mobilePayment, whatsappNumber, password, city, location, latitude, longitude, fullAddress, userId = null }) {
    // If we have a userId, we expect the user record already exists (with hashed password)
    // and we just create the profile.
    let hashedPassword = null;
    if (!userId) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const query = `
      INSERT INTO buyers (
        full_name, email, mobile_payment, whatsapp_number, password, 
        city, location, latitude, longitude, full_address, user_id, 
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `;
    const values = [
      fullName, email, mobilePayment, whatsappNumber, hashedPassword,
      city, location, latitude, longitude, fullAddress, userId
    ];
    const result = await pool.query(query, values);
    return toCamelCase(result.rows[0]);
  }

  // Create a new buyer for guest checkout (generates secure random password)
  static async createGuest({ fullName, email, mobilePayment, whatsappNumber, city, location, latitude, longitude, fullAddress }) {
    // Generate a secure random password for guest accounts
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const query = `
      INSERT INTO buyers (
        full_name, email, mobile_payment, whatsapp_number, password, 
        city, location, latitude, longitude, full_address, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      fullName, email, mobilePayment, whatsappNumber, hashedPassword,
      city, location, latitude, longitude, fullAddress
    ];
    const result = await pool.query(query, values);
    return toCamelCase(result.rows[0]);
  }

  // Create a Buyer instance from database row
  static createInstance(row) {
    if (!row) return null;
    const buyer = new Buyer();
    Object.assign(buyer, toCamelCase(row));
    return buyer;
  }

  // Find buyer by email
  static async findByEmail(email) {
    const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows.length ? this.createInstance(result.rows[0]) : null;
  }

  // Find buyer by phone number (checks multiple formats in both columns)
  static async findByPhone(phone) {
    if (!phone) return null;

    // Generate all possible phone formats to check
    let normalized = phone.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses

    // Create variations to search for
    const phoneVariations = [];

    // Add the phone as-is
    phoneVariations.push(normalized);

    // If starts with +254, add variations
    if (normalized.startsWith('+254')) {
      phoneVariations.push(normalized.substring(1)); // Remove +
      phoneVariations.push('0' + normalized.substring(4)); // +254712... -> 0712...
    }
    // If starts with 254 (no +)
    else if (normalized.startsWith('254')) {
      phoneVariations.push('+' + normalized); // Add +
      phoneVariations.push('0' + normalized.substring(3)); // 254712... -> 0712...
    }
    // If starts with 0
    else if (normalized.startsWith('0')) {
      phoneVariations.push('+254' + normalized.substring(1)); // 0712... -> +254712...
      phoneVariations.push('254' + normalized.substring(1)); // 0712... -> 254712...
    }
    // If just the number (e.g., 712345678)
    else {
      phoneVariations.push('0' + normalized); // 712... -> 0712...
      phoneVariations.push('+254' + normalized); // 712... -> +254712...
      phoneVariations.push('254' + normalized); // 712... -> 254712...
    }

    // Remove duplicates
    const uniqueVariations = [...new Set(phoneVariations)];

    console.log('Searching for phone variations in mobile_payment and whatsapp_number:', uniqueVariations);

    // Search for any of these variations in both columns
    const query = `
      SELECT *, user_id AS "userId" 
      FROM buyers 
      WHERE mobile_payment = ANY($1) OR whatsapp_number = ANY($1)
    `;
    const result = await pool.query(query, [uniqueVariations]);

    if (result.rows.length > 0) {
      console.log('Found buyer with matched phone variation');
    }

    return result.rows.length ? this.createInstance(result.rows[0]) : null;
  }

  // Find buyer by ID
  static async findById(id) {
    const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows.length ? this.createInstance(result.rows[0]) : null;
  }

  // Find buyer by user_id (for cross-role access)
  static async findByUserId(userId) {
    const query = 'SELECT *, user_id AS "userId" FROM buyers WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows.length ? this.createInstance(result.rows[0]) : null;
  }

  // Update buyer
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Field name mapping from camelCase to snake_case
    const fieldMap = {
      fullName: 'full_name',
      mobilePayment: 'mobile_payment',
      whatsappNumber: 'whatsapp_number',
      city: 'city',
      location: 'location',
      latitude: 'latitude',
      longitude: 'longitude',
      fullAddress: 'full_address',
      isVerified: 'is_verified',
      profileImage: 'profile_image'
      // Add other fields as needed
    };

    for (const [key, value] of Object.entries(updateData)) {
      // Skip password updates here - handle separately with updatePassword
      if (key === 'password') continue;

      // Convert camelCase to snake_case for database columns
      const dbField = fieldMap[key] || key;
      fields.push(`${dbField} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    // Add updated_at
    fields.push('updated_at = NOW()');

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const query = `
      UPDATE buyers 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);
    const result = await pool.query(query, values);
    return result.rows.length ? toCamelCase(result.rows[0]) : null;
  }

  // Update buyer location coordinates
  static async updateLocation(buyerId, { latitude, longitude, fullAddress }) {
    const query = `
      UPDATE buyers 
      SET latitude = $1, longitude = $2, full_address = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [latitude, longitude, fullAddress, buyerId]);
    return result.rows.length ? toCamelCase(result.rows[0]) : null;
  }

  // Auth methods removed

}

export default Buyer;
