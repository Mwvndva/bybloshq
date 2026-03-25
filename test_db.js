import { pool } from './server/src/config/database.js';

async function checkAndAddColumn() {
    try {
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password_changed_at'
    `);

        if (res.rows.length === 0) {
            console.log('Column password_changed_at is missing. Adding it...');
            await pool.query('ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP');
            console.log('Column added successfully.');
        } else {
            console.log('Column password_changed_at already exists.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
        process.exit();
    }
}

checkAndAddColumn();
