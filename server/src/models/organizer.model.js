import { pool } from '../config/database.js';

const Organizer = {
  // Find by Email
  async findByEmail(email) {
    const result = await pool.query('SELECT * FROM organizers WHERE email = $1', [email]);
    return result.rows[0];
  },

  // Find by ID
  async findById(id) {
    const result = await pool.query('SELECT * FROM organizers WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Create Organizer
  async create({ full_name, email, phone, password }) {
    const result = await pool.query(
      `INSERT INTO organizers 
       (full_name, email, phone, password, is_verified)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, full_name, email, phone, created_at`,
      [full_name, email, phone, password] // Password assumed hashed by service
    );
    return result.rows[0];
  },

  // Update Last Login
  async updateLastLogin(id) {
    await pool.query(
      'UPDATE organizers SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  },

  // Update Organizer fields
  async findByIdAndUpdate(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return null;

    values.push(id);

    const query = `
      UPDATE organizers 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, full_name, email, phone, created_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Token Management (DB only)
  async savePasswordResetToken(email, hashedToken, expiresAt) {
    await pool.query(
      `UPDATE organizers 
       SET password_reset_token = $1, 
           password_reset_expires = $2 
       WHERE email = $3`,
      [hashedToken, expiresAt, email]
    );
  },

  async findByResetToken(token) {
    // Logic often requires checking hash match, but traditionally we search by token if stored plain.
    // If stored hashed, we must query by email first, or if we don't have email, we can't search.
    // The previous implementation queried by email first then checked token.
    // We will provide a lookup by email helper.
    return null; // Not typically used directly if tokens are hashed
  },

  async getResetTokenData(email) {
    const result = await pool.query(
      `SELECT password_reset_token, password_reset_expires 
         FROM organizers 
         WHERE email = $1 AND password_reset_expires > NOW()`,
      [email]
    );
    return result.rows[0];
  },

  async clearResetTokenAndUpdatePassword(email, hashedPassword) {
    const result = await pool.query(
      `UPDATE organizers 
       SET password = $1, 
           password_reset_token = NULL, 
           password_reset_expires = NULL 
       WHERE email = $2
       RETURNING id, full_name, email, phone`,
      [hashedPassword, email]
    );
    return result.rows[0];
  }
};

export default Organizer;
