import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env BEFORE importing database module
const envFile = process.env.DOTENV_CONFIG_PATH || '.env';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

async function seedAdmin() {
    const { pool } = await import('../src/infrastructure/database/database.js');
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email) {
        console.error('❌ ERROR: ADMIN_EMAIL environment variable is required');
        process.exit(1);
    }

    if (!password) {
        console.error('❌ ERROR: ADMIN_PASSWORD environment variable is required');
        console.log('Usage: ADMIN_PASSWORD=your_secure_password ADMIN_EMAIL=admin@example.com node server/scripts/seed-admin.js');
        process.exit(1);
    }

    try {
        console.log(`🚀 Seeding admin user: ${email}...`);

        const hash = await bcrypt.hash(password, 12);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Insert admin user
            const userRes = await client.query(
                `INSERT INTO users (email, password_hash, role, is_verified, is_active)
         VALUES ($1, $2, 'admin', true, true)
         ON CONFLICT (email) 
         DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true
         RETURNING id`,
                [email, hash]
            );

            console.log(`✅ Admin user ${email} created/updated (ID: ${userRes.rows[0].id})`);

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        console.log('✨ Admin seeding completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to seed admin:', error.message);
        process.exit(1);
    }
}

seedAdmin();
