import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkAdminUser() {
    try {
        console.log('Checking for admin user in database...\n');

        const result = await pool.query(
            'SELECT id, email, role, is_verified, is_active, password_hash FROM users WHERE email = $1',
            ['admin@bybloshq.space']
        );

        if (result.rows.length === 0) {
            console.log('❌ Admin user NOT found in database');
            console.log('\nThe migration may not have been run.');
            console.log('Run: node run_migration_temp.js migrations/20260208_unified_schema_v3.sql');
        } else {
            const user = result.rows[0];
            console.log('✅ Admin user found in database:');
            console.log('ID:', user.id);
            console.log('Email:', user.email);
            console.log('Role:', user.role);
            console.log('Is Verified:', user.is_verified);
            console.log('Is Active:', user.is_active);
            console.log('Password Hash:', user.password_hash);
            console.log('\nExpected Hash: $2b$12$ohCGGI4Os2vVagYuaU4fRucG7S9G1Z3vrXZXBV0BGGkT9qxh6IDhu');
            console.log('Hashes Match:', user.password_hash === '$2b$12$ohCGGI4Os2vVagYuaU4fRucG7S9G1Z3vrXZXBV0BGGkT9qxh6IDhu');
        }

        await pool.end();
        process.exit(result.rows.length > 0 ? 0 : 1);
    } catch (error) {
        console.error('Error:', error.message);
        console.error('\nDatabase connection failed. Check your .env file:');
        console.error('- DB_HOST');
        console.error('- DB_PORT');
        console.error('- DB_NAME');
        console.error('- DB_USER');
        console.error('- DB_PASSWORD');
        await pool.end();
        process.exit(1);
    }
}

checkAdminUser();
