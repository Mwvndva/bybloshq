import 'dotenv/config';
import pg from 'pg';
import migrate from 'node-pg-migrate';
import path from 'path';
import { fileURLToPath } from 'url';

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function run() {
    // 1. Environment Check
    if (!process.env.DATABASE_URL || !process.env.DB_PASSWORD) {
        console.error('ERROR: Database credentials missing in .env');
        process.exit(1);
    }

    // 2. Logging
    console.log(`[${new Date().toISOString()}] [INFO] Connecting to Database...`);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        // 3. Pre-Flight Connection
        await pool.query('SELECT 1');
        console.log(`[${new Date().toISOString()}] [SUCCESS] Connection established.`);

        // 4. Migration Execution
        console.log(`[${new Date().toISOString()}] [INFO] Running Migrations...`);

        await migrate({
            dir: 'migrations', // Relative to CWD (server/)
            direction: 'up',
            migrationsTable: 'pgmigrations',
            databaseUrl: process.env.DATABASE_URL,
            verbose: true,
        });

        console.log(`[${new Date().toISOString()}] [SUCCESS] Migrations completed.`);

    } catch (err) {
        console.error(`[${new Date().toISOString()}] [ERROR] Migration failed:`, err);
        process.exit(1);
    } finally {
        // 5. Graceful Exit
        await pool.end();
    }
}

run();

// Handle process termination signals
process.on('SIGINT', () => {
    console.log('\nMigration interrupted.');
    process.exit(0);
});
