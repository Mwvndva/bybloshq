import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrateUsers = async () => {
    const client = await pool.connect();

    try {
        console.log('Starting user migration...');
        await client.query('BEGIN');

        // 1. Migrate Buyers
        console.log('Migrating Buyers...');
        const buyers = await client.query('SELECT * FROM buyers WHERE user_id IS NULL');
        console.log(`Found ${buyers.rows.length} buyers to migrate.`);

        for (const buyer of buyers.rows) {
            // Check if user already exists (by email)
            const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [buyer.email]);

            let userId;

            if (existingUser.rows.length > 0) {
                console.log(`User with email ${buyer.email} already exists. Linking...`);
                userId = existingUser.rows[0].id;
            } else {
                const insertRes = await client.query(
                    `INSERT INTO users (email, password_hash, role, is_verified, created_at, updated_at)
           VALUES ($1, $2, 'buyer', $3, $4, $5)
           RETURNING id`,
                    [buyer.email, buyer.password, buyer.is_verified || true, buyer.created_at, buyer.updated_at] // Assuming active buyers are verified or default true for now
                );
                userId = insertRes.rows[0].id;
            }

            await client.query('UPDATE buyers SET user_id = $1 WHERE id = $2', [userId, buyer.id]);
        }

        // 2. Migrate Sellers
        console.log('Migrating Sellers...');
        const sellers = await client.query('SELECT * FROM sellers WHERE user_id IS NULL');
        console.log(`Found ${sellers.rows.length} sellers to migrate.`);

        for (const seller of sellers.rows) {
            const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [seller.email]);

            let userId;

            if (existingUser.rows.length > 0) {
                console.log(`User with email ${seller.email} already exists. Linking...`);
                userId = existingUser.rows[0].id;
                // Optimization: If user exists, we might need to handle role conflict or dual roles logic.
                // For now, simpler approach: If email exists, they are ALREADY a user (e.g. buyer), 
                // we just link the profile. The 'role' column in 'users' might need to be 'multi' or we stick to primary role.
                // Or we update the role if seller is more privileged? 
                // Let's keep existing role but link.
            } else {
                const insertRes = await client.query(
                    `INSERT INTO users (email, password_hash, role, is_verified, created_at, updated_at)
           VALUES ($1, $2, 'seller', $3, $4, $5)
           RETURNING id`,
                    [seller.email, seller.password, true, seller.created_at, seller.updated_at]
                );
                userId = insertRes.rows[0].id;
            }

            await client.query('UPDATE sellers SET user_id = $1 WHERE id = $2', [userId, seller.id]);
        }

        // 3. Migrate Organizers
        console.log('Migrating Organizers...');
        const organizers = await client.query('SELECT * FROM organizers WHERE user_id IS NULL');
        console.log(`Found ${organizers.rows.length} organizers to migrate.`);

        for (const organizer of organizers.rows) {
            const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [organizer.email]);

            let userId;

            if (existingUser.rows.length > 0) {
                console.log(`User with email ${organizer.email} already exists. Linking...`);
                userId = existingUser.rows[0].id;
            } else {
                const insertRes = await client.query(
                    `INSERT INTO users (email, password_hash, role, is_verified, created_at, updated_at)
           VALUES ($1, $2, 'organizer', $3, $4, $5)
           RETURNING id`,
                    [organizer.email, organizer.password, organizer.is_verified || false, organizer.created_at, organizer.updated_at]
                );
                userId = insertRes.rows[0].id;
            }

            await client.query('UPDATE organizers SET user_id = $1 WHERE id = $2', [userId, organizer.id]);
        }

        await client.query('COMMIT');
        console.log('Migration completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
};

migrateUsers();
