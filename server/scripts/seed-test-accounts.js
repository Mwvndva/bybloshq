/**
 * seed-test-accounts.js
 *
 * Creates a coherent, LOGIN-ABLE set of interconnected test accounts so the
 * fulfilment / commission / referral / self-referral flows can be exercised by
 * a real person on a dev or staging box — not only asserted in code. Every
 * account is created the way the app expects: a verified, active row in the
 * unified `users` table (bcrypt password, cost 12) with the matching profile
 * (buyers / sellers / creators) linked by user_id, plus the relationships the
 * fixed logic depends on (a seller⇄creator link, a creator-referred seller, and
 * a creator who is also their own buyer for the self-referral case).
 *
 * Idempotent: re-running upserts by email / user_id, so it is safe to run
 * repeatedly and to re-run after a schema reset.
 *
 * SAFETY: this writes accounts, so it refuses to run unless you opt in
 * explicitly with SEED_TEST_ACCOUNTS=true, and it refuses against anything that
 * looks like a production host. The credentials are fixed, obviously-test
 * values printed at the end.
 *
 * Usage:
 *   SEED_TEST_ACCOUNTS=true node scripts/seed-test-accounts.js
 *   SEED_TEST_ACCOUNTS=true DOTENV_CONFIG_PATH=.env.staging node scripts/seed-test-accounts.js
 */
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Load env (mirrors scripts/migrate.js resolution) -----------------------
(() => {
  let envPath;
  if (process.env.DOTENV_CONFIG_PATH) {
    envPath = path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH);
  } else if (process.env.NODE_ENV === 'test') {
    envPath = path.resolve(__dirname, '../.env.test');
  } else {
    envPath = path.resolve(__dirname, '../.env');
  }
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: true });
})();

// --- Safety guards ----------------------------------------------------------
if (process.env.SEED_TEST_ACCOUNTS !== 'true') {
  console.error('Refusing to run: set SEED_TEST_ACCOUNTS=true to confirm you want to seed test accounts into this database.');
  process.exit(1);
}
{
  const host = String(process.env.DB_HOST || '');
  const dbUrl = String(process.env.DATABASE_URL || '');
  const looksProd = host.includes('render.com') || host.includes('amazonaws.com') || dbUrl.includes('render.com') || dbUrl.includes('amazonaws.com');
  if (looksProd) {
    console.error(`FATAL SAFETY GUARD: "${host || dbUrl}" looks like a production host. Refusing to seed test accounts.`);
    process.exit(1);
  }
}

const { pool } = await import('../src/infrastructure/database/database.js');

const BCRYPT_COST = 12;
const COMMISSION_RATE = 0.10; // 10% — high enough that creator commission is clearly visible in tests

// Fixed, obviously-test credentials. Safe to print; these are not production secrets.
const ACCOUNTS = {
  admin:   { email: 'admin@byblos.test',   password: 'ByblosTest#Admin1',   role: 'admin' },
  seller:  { email: 'seller@byblos.test',  password: 'ByblosTest#Seller1',  role: 'seller' },
  creator: { email: 'creator@byblos.test', password: 'ByblosTest#Creator1', role: 'creator' },
  buyer:   { email: 'buyer@byblos.test',   password: 'ByblosTest#Buyer1',   role: 'buyer' }
};

async function ensureRoles(client) {
  // The `roles` table backs users.role (FK to roles.slug) and user_roles. A
  // schema-only restore has it empty, so make sure the slugs we assign exist.
  await client.query(
    `INSERT INTO roles (name, slug) VALUES
       ('Buyer','buyer'),('Seller','seller'),('Admin','admin'),
       ('Creator','creator'),('Logistics','logistics')
     ON CONFLICT (slug) DO NOTHING`
  );
}

async function upsertUser(client, { email, password, role }) {
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const roleExists = (await client.query('SELECT 1 FROM roles WHERE slug = $1', [role])).rows.length > 0;
  const safeRole = roleExists ? role : null;
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, role, is_verified, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, TRUE, TRUE, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           is_verified = TRUE,
           is_active = TRUE,
           updated_at = NOW()
     RETURNING id`,
    [email.toLowerCase(), hash, safeRole]
  );
  return rows[0].id;
}

async function ensureRoleLink(client, userId, roleSlug) {
  const role = await client.query('SELECT id FROM roles WHERE slug = $1', [roleSlug]);
  if (!role.rows[0]) return;
  await client.query(
    'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, role.rows[0].id]
  );
}

async function upsertBuyer(client, userId, { email, fullName, mobilePayment }) {
  const existing = await client.query('SELECT id FROM buyers WHERE user_id = $1', [userId]);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE buyers SET full_name = $2, email = $3, mobile_payment = $4, terms_accepted = TRUE, is_verified = TRUE, updated_at = NOW() WHERE id = $1`,
      [existing.rows[0].id, fullName, email.toLowerCase(), mobilePayment]
    );
    return existing.rows[0].id;
  }
  const { rows } = await client.query(
    `INSERT INTO buyers (user_id, full_name, email, mobile_payment, terms_accepted, is_verified, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, TRUE, 'active', NOW(), NOW()) RETURNING id`,
    [userId, fullName, email.toLowerCase(), mobilePayment]
  );
  return rows[0].id;
}

async function upsertSeller(client, userId, { email, fullName, shopName, referredByCreatorId = null }) {
  const existing = await client.query('SELECT id FROM sellers WHERE user_id = $1', [userId]);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE sellers SET full_name = $2, shop_name = $3, email = $4, terms_accepted = TRUE, is_active = TRUE,
              creator_commission_rate = $5, referred_by_creator_id = COALESCE($6, referred_by_creator_id), updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, fullName, shopName, email.toLowerCase(), COMMISSION_RATE, referredByCreatorId]
    );
    return existing.rows[0].id;
  }
  const { rows } = await client.query(
    `INSERT INTO sellers (user_id, full_name, shop_name, email, terms_accepted, is_active, status,
            creator_commission_rate, referred_by_creator_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, TRUE, 'active', $5, $6, NOW(), NOW()) RETURNING id`,
    [userId, fullName, shopName, email.toLowerCase(), COMMISSION_RATE, referredByCreatorId]
  );
  return rows[0].id;
}

async function upsertCreator(client, userId, { email, firstName, lastName, mpesaNumber, referralCode }) {
  const existing = await client.query('SELECT id FROM creators WHERE user_id = $1', [userId]);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE creators SET first_name = $2, last_name = $3, email = $4, mpesa_number = $5,
              referral_code = COALESCE(creators.referral_code, $6), status = 'active', updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, firstName, lastName, email.toLowerCase(), mpesaNumber, referralCode]
    );
    return existing.rows[0].id;
  }
  const { rows } = await client.query(
    `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number, referral_code, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW()) RETURNING id`,
    [userId, firstName, lastName, email.toLowerCase(), mpesaNumber, referralCode]
  );
  return rows[0].id;
}

async function ensureSellerCreatorLink(client, sellerId, creatorId, code) {
  await client.query(
    `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
     ON CONFLICT (seller_id, creator_id) DO UPDATE
       SET commission_rate = EXCLUDED.commission_rate, status = 'active', updated_at = NOW()`,
    [sellerId, creatorId, code, COMMISSION_RATE]
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureRoles(client);

    // Admin
    const adminUserId = await upsertUser(client, ACCOUNTS.admin);
    await ensureRoleLink(client, adminUserId, 'admin');

    // Creator (+ their own buyer profile, for the self-referral scenario)
    const creatorUserId = await upsertUser(client, ACCOUNTS.creator);
    await ensureRoleLink(client, creatorUserId, 'creator');
    await ensureRoleLink(client, creatorUserId, 'buyer');
    const creatorId = await upsertCreator(client, creatorUserId, {
      email: ACCOUNTS.creator.email, firstName: 'Test', lastName: 'Creator',
      mpesaNumber: '254700000001', referralCode: 'TESTCREATOR'
    });
    const creatorOwnBuyerId = await upsertBuyer(client, creatorUserId, {
      email: ACCOUNTS.creator.email, fullName: 'Test Creator (own buyer)', mobilePayment: '254700000001'
    });

    // Seller — referred by the creator, so both the referral reward and the
    // per-sale commission paths have data.
    const sellerUserId = await upsertUser(client, ACCOUNTS.seller);
    await ensureRoleLink(client, sellerUserId, 'seller');
    const sellerId = await upsertSeller(client, sellerUserId, {
      email: ACCOUNTS.seller.email, fullName: 'Test Seller', shopName: 'Test Atelier',
      referredByCreatorId: creatorId
    });
    await ensureSellerCreatorLink(client, sellerId, creatorId, 'TESTCREATORLINK');

    // Independent, legitimate buyer (no relationship to the creator).
    const buyerUserId = await upsertUser(client, ACCOUNTS.buyer);
    await ensureRoleLink(client, buyerUserId, 'buyer');
    const buyerId = await upsertBuyer(client, buyerUserId, {
      email: ACCOUNTS.buyer.email, fullName: 'Test Buyer', mobilePayment: '254700000002'
    });

    await client.query('COMMIT');

    console.log('\n✅ Test accounts seeded (idempotent). Logins:\n');
    console.table([
      { role: 'admin',   email: ACCOUNTS.admin.email,   password: ACCOUNTS.admin.password,   ids: `user=${adminUserId}` },
      { role: 'seller',  email: ACCOUNTS.seller.email,  password: ACCOUNTS.seller.password,  ids: `user=${sellerUserId} seller=${sellerId}` },
      { role: 'creator', email: ACCOUNTS.creator.email, password: ACCOUNTS.creator.password, ids: `user=${creatorUserId} creator=${creatorId} ownBuyer=${creatorOwnBuyerId}` },
      { role: 'buyer',   email: ACCOUNTS.buyer.email,   password: ACCOUNTS.buyer.password,   ids: `user=${buyerUserId} buyer=${buyerId}` }
    ]);
    console.log('\nRelationships wired:');
    console.log(`  • seller "Test Atelier" (id ${sellerId}) is linked to creator ${creatorId} (seller_creator_links code TESTCREATORLINK, ${COMMISSION_RATE * 100}% commission)`);
    console.log(`  • seller ${sellerId}.referred_by_creator_id = ${creatorId} (creator referral reward path)`);
    console.log(`  • creator ${creatorId} also owns buyer profile ${creatorOwnBuyerId} on the same user (self-referral scenario)`);
    console.log(`  • buyer ${buyerId} is an independent, legitimate buyer (control case)`);
    console.log('\nMzigo Ego logistics login is bootstrapped from MZIGO_EGO_EMAIL / MZIGO_EGO_PASSWORD on first login — set those and log in to create it.\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch(() => process.exit(1));
