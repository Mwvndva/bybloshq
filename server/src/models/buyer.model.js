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
  static async create({ fullName, email, phone, password, city, location }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const query = `
      INSERT INTO buyers (full_name, email, phone, password, city, location, is_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING *
    `;
    
    const values = [fullName, email, phone, hashedPassword, city, location];
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
    const query = 'SELECT * FROM buyers WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows.length ? this.createInstance(result.rows[0]) : null;
  }

  // Find buyer by ID
  static async findById(id) {
    const query = 'SELECT * FROM buyers WHERE id = $1';
    const result = await pool.query(query, [id]);
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
      phone: 'phone',
      city: 'city',
      location: 'location',
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

  // Update password
  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const query = `
      UPDATE buyers 
      SET password = $1, 
          password_changed_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [hashedPassword, id]);
    return result.rows.length ? toCamelCase(result.rows[0]) : null;
  }

  // Check if password was changed after JWT was issued
  changedPasswordAfter(JWTTimestamp) {
    if (this.passwordChangedAt) {
      const changedTimestamp = parseInt(
        new Date(this.passwordChangedAt).getTime() / 1000,
        10
      );
      return JWTTimestamp < changedTimestamp;
    }
    // False means NOT changed
    return false;
  }

  // Set password reset token
  static async setPasswordResetToken(email) {
    const { resetToken, hashedToken, resetPasswordExpires } = this.createPasswordResetToken();
    
    const query = `
      UPDATE buyers 
      SET reset_password_token = $1, 
          reset_password_expires = $2,
          updated_at = NOW()
      WHERE email = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [hashedToken, resetPasswordExpires, email]);
    
    if (!result.rows.length) {
      throw new Error('No buyer found with that email');
    }
    
    return {
      resetToken,
      buyer: toCamelCase(result.rows[0])
    };
  }

  // Create password reset token
  static createPasswordResetToken() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
      
    const resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    return { resetToken, hashedToken, resetPasswordExpires };
  }

  // Reset password with token
  static async resetPassword(token, newPassword) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Check if token is valid and not expired
    const checkQuery = `
      SELECT * FROM buyers 
      WHERE reset_password_token = $1 
      AND reset_password_expires > NOW()
    `;
    
    const checkResult = await pool.query(checkQuery, [hashedToken]);
    
    if (!checkResult.rows.length) {
      throw new Error('Invalid or expired token');
    }
    
    // Update password and clear reset token
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const updateQuery = `
      UPDATE buyers 
      SET password = $1,
          reset_password_token = NULL,
          reset_password_expires = NULL,
          updated_at = NOW()
      WHERE reset_password_token = $2
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [hashedPassword, hashedToken]);
    return toCamelCase(result.rows[0]);
  }

  // Validate password
  static async validatePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }
}

export default Buyer;
