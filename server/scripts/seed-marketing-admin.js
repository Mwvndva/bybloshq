/**
 * seed-marketing-admin.js
 * Seeds the marketing admin user with the correct bcrypt password hash.
 * Run: node scripts/seed-marketing-admin.js
 */
import bcrypt from 'bcrypt'
import { pool } from '../src/config/database.js'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import logger from '../src/utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

if (process.env.NODE_ENV === 'production') {
    logger.warn('⚠️ WARNING: Running seed-marketing-admin in PRODUCTION environment! This is NOT RECOMMENDED.');
}

const MARKETING_EMAIL = 'adminmarketing@bybloshq.space'
const MARKETING_PASSWORD = process.env.MARKETING_ADMIN_PASSWORD

if (!MARKETING_PASSWORD) {
    console.error('❌ Error: MARKETING_ADMIN_PASSWORD environment variable is not set!')
    process.exit(1)
}

const SALT_ROUNDS = 12

try {
    console.log('🔐 Seeding marketing admin user...')
    const hash = await bcrypt.hash(MARKETING_PASSWORD, SALT_ROUNDS)
    const hashVerified = await bcrypt.compare(MARKETING_PASSWORD, hash)
    if (!hashVerified) throw new Error('Hash verification failed')

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
       RETURNING id, email, role`,
        [MARKETING_EMAIL, hash]
    )

    const user = result.rows[0]
    console.log('✅ Marketing admin seeded successfully')
    console.log(`   ID:    ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Role:  ${user.role}`)
    console.log('')
    console.log('🎉 Done. Login at /marketing/login.')
} catch (err) {
    console.error('❌ Seeding failed:', err.message)
    process.exit(1)
} finally {
    await pool.end()
}
