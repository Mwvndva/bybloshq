
import { pool } from '../src/config/database.js';

async function syncRoles() {
    console.log('🔄 Starting User Roles Sync...');

    try {
        // 1. Get all roles
        const rolesResult = await pool.query('SELECT id, slug FROM roles');
        const roles = rolesResult.rows.reduce((acc, row) => {
            acc[row.slug] = row.id;
            return acc;
        }, {});

        console.log('Fetched roles:', roles);

        // 2. Sync Sellers
        const sellersResult = await pool.query('SELECT user_id FROM sellers WHERE user_id IS NOT NULL');
        console.log(`Linking ${sellersResult.rows.length} sellers...`);
        for (const row of sellersResult.rows) {
            await pool.query(
                'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [row.user_id, roles['seller']]
            );
        }

        // 3. Sync Buyers
        const buyersResult = await pool.query('SELECT user_id FROM buyers WHERE user_id IS NOT NULL');
        console.log(`Linking ${buyersResult.rows.length} buyers...`);
        for (const row of buyersResult.rows) {
            await pool.query(
                'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [row.user_id, roles['buyer']]
            );
        }

        // 4. Sync Organizers
        const organizersResult = await pool.query('SELECT user_id FROM organizers WHERE user_id IS NOT NULL');
        console.log(`Linking ${organizersResult.rows.length} organizers...`);
        for (const row of organizersResult.rows) {
            await pool.query(
                'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [row.user_id, roles['organizer']]
            );
        }

        console.log('✅ Sync Completed Successfully');
    } catch (error) {
        console.error('❌ Sync Failed:', error);
    } finally {
        await pool.end();
    }
}

syncRoles();
