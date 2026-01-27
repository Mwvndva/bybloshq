import { query, pool } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function diagnose() {
    try {
        console.log('--- Sellers Columns ---');
        const cols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sellers'");
        console.table(cols.rows);

        console.log('--- Roles ---');
        const roles = await query('SELECT * FROM roles');
        console.table(roles.rows);

        console.log('\n--- Permissions with Length ---');
        const perms = await query('SELECT id, name, slug, LENGTH(slug) as len FROM permissions');
        console.table(perms.rows);

        console.log('\n--- Role Permissions ---');
        const rolePerms = await query(`
            SELECT r.slug as role, p.slug as perm 
            FROM role_permissions rp 
            JOIN roles r ON rp.role_id = r.id 
            JOIN permissions p ON rp.permission_id = p.id
        `);
        console.table(rolePerms.rows);

        console.log('\n--- Specific User Check: roynth@gmail.com ---');
        const roynth = await query("SELECT id FROM users WHERE email = 'roynth@gmail.com'");
        if (roynth.rows[0]) {
            const uid = roynth.rows[0].id;
            const uparms = await query(`
                SELECT p.slug
                FROM user_roles ur
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ur.user_id = $1
            `, [uid]);
            console.log(`Permissions for ${uid}:`);
            console.table(uparms.rows);
        } else {
            console.log('User roynth@gmail.com not found');
        }

    } catch (error) {
        console.error('Diagnosis failed:', error);
    } finally {
        await pool.end();
    }
}

diagnose();
