/**
 * reset-admin-password.js
 *
 * One-time maintenance script to create or reset the admin user in the database.
 * Run this on the server when the admin login reports "Invalid email or password".
 *
 * Usage:
 *   cd /home/admin/apps/bybloshq/server
 *   node scripts/reset-admin-password.js
 *
 * Optional — override email/password via env:
 *   ADMIN_EMAIL=admin@bybloshq.space ADMIN_PASSWORD=14253553805 node scripts/reset-admin-password.js
 */

import bcrypt from 'bcrypt';
import { pool } from '../src/config/database.js';

// ── Configuration ─────────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bybloshq.space';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '14253553805';
const SALT_ROUNDS = 12;
// ─────────────────────────────────────────────────────────────────────────────

async function resetAdminPassword() {
    console.log('🔐 Admin Password Reset Script');
    console.log('================================');
    console.log(`  Target email: ${ADMIN_EMAIL}`);
    console.log('');

    try {
        // 1. Hash the password
        console.log('⏳ Hashing password...');
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
        console.log('✅ Password hashed successfully');

        // 2. Verify the hash works (sanity check)
        const hashVerified = await bcrypt.compare(ADMIN_PASSWORD, passwordHash);
        if (!hashVerified) {
            throw new Error('Hash verification failed — bcrypt compare returned false right after hashing!');
        }
        console.log('✅ Hash verified successfully');

        // 3. Upsert the admin user into users table
        console.log('⏳ Upserting admin user into database...');
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, role, is_verified, is_active, created_at, updated_at)
       VALUES ($1, $2, 'admin', true, true, NOW(), NOW())
       ON CONFLICT (email)
       DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role          = 'admin',
         is_verified   = true,
         is_active     = true,
         updated_at    = NOW()
       RETURNING id, email, role, is_verified, is_active, created_at`,
            [ADMIN_EMAIL, passwordHash]
        );

        const adminUser = result.rows[0];
        console.log('');
        console.log('✅ Admin user upserted successfully!');
        console.log('────────────────────────────────────');
        console.log(`   ID:         ${adminUser.id}`);
        console.log(`   Email:      ${adminUser.email}`);
        console.log(`   Role:       ${adminUser.role}`);
        console.log(`   Verified:   ${adminUser.is_verified}`);
        console.log(`   Active:     ${adminUser.is_active}`);
        console.log(`   Created:    ${adminUser.created_at}`);
        console.log('');

        // 4. Assign the admin role in user_roles table (RBAC), if the table exists
        const rbacCheck = await pool.query(
            `SELECT id FROM roles WHERE slug = 'admin' LIMIT 1`
        );

        if (rbacCheck.rows.length > 0) {
            const adminRoleId = rbacCheck.rows[0].id;
            await pool.query(
                `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
                [adminUser.id, adminRoleId]
            );
            console.log(`✅ Admin role (id ${adminRoleId}) assigned in user_roles table`);
        } else {
            console.log('ℹ️  No admin role found in roles table — skipping RBAC assignment');
        }

        console.log('');
        console.log('🎉 Done! You can now log in at /admin/login with:');
        console.log(`   Email:    ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);

    } catch (error) {
        console.error('');
        console.error('❌ Script failed:', error.message);
        if (error.code === '23505') {
            // Should not happen with ON CONFLICT, but just in case
            console.error('   Hint: Duplicate key — the upsert should have handled this. Check your DB constraints.');
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

resetAdminPassword();
