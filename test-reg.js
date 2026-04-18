
import { pool } from './server/src/config/database.js';
import AuthService from './server/src/services/auth.service.js';

async function test() {
    const email = `test-seller-${Date.now()}@example.com`;
    const data = {
        fullName: 'Test Seller',
        shopName: `shop${Date.now()}`,
        email: email,
        whatsappNumber: '0712345678',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        city: 'Nairobi',
        location: 'CBD',
        termsAccepted: true
    };

    console.log('--- Registering New Seller ---');
    try {
        const result = await AuthService.register(data, 'seller');
        console.log('Registration Result:', result);

        // Check if user was created in users table
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        console.log('User in Database:', user.rows[0] ? 'Found' : 'Not Found');

        // Check pending_registrations
        const pending = await pool.query('SELECT * FROM pending_registrations WHERE email = $1', [email.toLowerCase()]);
        console.log('Pending Registration in Database:', pending.rows[0] ? 'Found' : 'Not Found');

    } catch (error) {
        console.error('Registration Error:', error.message);
    } finally {
        await pool.end();
    }
}

test();
