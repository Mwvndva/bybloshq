import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

class User {
  // Create a new user
  static async create({ firstName, lastName, email, phoneNumber, password, role = 'user' }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (
        first_name, 
        last_name, 
        email, 
        phone_number, 
        password, 
        role
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, first_name, last_name, email, phone_number, role, is_email_verified, created_at, updated_at
    `;

    const values = [firstName, lastName, email, phoneNumber, hashedPassword, role];
    const result = await pool.query(query, values);
    return toCamelCase(result.rows[0]);
  }

  // Find user by email
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
  }

  // Find user by ID
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
  }

  // Validate password
  static async validatePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  // Generate JWT token
  static generateAuthToken(user) {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );
  }

  // Update user
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Handle password hashing if password is being updated
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    // Convert camelCase to snake_case for database
    const fieldMap = {
      firstName: 'first_name',
      lastName: 'last_name',
      phoneNumber: 'phone_number',
      isEmailVerified: 'is_email_verified',
      emailVerificationToken: 'email_verification_token',
      emailVerificationExpires: 'email_verification_expires',
      passwordResetToken: 'password_reset_token',
      passwordResetExpires: 'password_reset_expires',
      lastLogin: 'last_login',
      isActive: 'is_active'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key] || key;
      fields.push(`${dbField} = $${paramCount++}`);
      values.push(value);
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] ? toCamelCase(result.rows[0]) : null;
  }
}

export default User;
