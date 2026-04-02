import dotenv from 'dotenv';
import pg from 'pg';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Task 1: Correct the Import using createRequire for robust CJS handling
const migrate = require('node-pg-migrate').default || require('node-pg-migrate');

// Task 1: Absolute Path Loading & Task 2: Debugging
let envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
    envPath = path.resolve(__dirname, '../.env.production');
}
const envExists = fs.existsSync(envPath);

console.log('--- Pre-flight Check ---');
console.log(`CWD: ${process.cwd()}`);
console.log(`Resolved .env path: ${envPath}`);
console.log(`.env exists: ${envExists}`);
console.log('------------------------');

// Load .env explicitly
dotenv.config({ path: envPath });

const { Pool } = pg;

async function run() {
    console.log(`[${new Date().toISOString()}] [DEBUG] Initial DATABASE_URL: ${process.env.DATABASE_URL ? (process.env.DATABASE_URL.substring(0, 15) + '...') : 'undefined'}`);

    // Task 3: Robust Fallback Logic
    // If we have individual components, ALWAYS use them as they are usually the most up-to-date
    if (process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME) {
        const host = process.env.DB_HOST || 'postgres'; // Docker service name default
        const port = process.env.DB_PORT || 5432;
        process.env.DATABASE_URL = `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${host}:${port}/${process.env.DB_NAME}`;
        console.log(`[${new Date().toISOString()}] [INFO] Forced DATABASE_URL from components: postgres://${process.env.DB_USER}:****@${host}:${port}/${process.env.DB_NAME}`);
    } else if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'undefined' || process.env.DATABASE_URL === 'null' || process.env.DATABASE_URL.trim() === '') {
        console.error('ERROR: Database credentials (individual DB_* variables) missing in environment');
        process.exit(1);
    }



    // 1. Environment Check
    if (!process.env.DATABASE_URL) {
        console.error('ERROR: Database credentials (DATABASE_URL or components) missing in .env');
        process.exit(1);
    }

    // 2. Logging
    console.log(`[${new Date().toISOString()}] [INFO] Connecting to Database...`);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),

    });

    try {
        // 3. Pre-Flight Connection
        await pool.query('SELECT 1');
        console.log(`[${new Date().toISOString()}] [SUCCESS] Connection established.`);

        // 4. Migration Execution
        console.log(`[${new Date().toISOString()}] [INFO] Running Migrations...`);

        // Task 2: Fix the Function Call & Task 3: Path Verification
        await migrate({
            dir: path.resolve(__dirname, '../migrations'), // Ensure absolute path to migrations folder
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
