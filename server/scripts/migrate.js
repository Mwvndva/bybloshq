import dotenv from 'dotenv';
import pg from 'pg';
import migrate from 'node-pg-migrate';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Task 1: Absolute Path Loading & Task 2: Debugging
const envPath = path.resolve(__dirname, '../.env');
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
    // Task 3: Fallback Logic
    if (!process.env.DATABASE_URL) {
        // Attempt to construct from components
        if (process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME) {
            const host = process.env.DB_HOST || 'localhost';
            const port = process.env.DB_PORT || 5432;
            process.env.DATABASE_URL = `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${host}:${port}/${process.env.DB_NAME}`;
            console.log(`[${new Date().toISOString()}] [INFO] Constructed DATABASE_URL from individual variables.`);
        }
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
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        // 3. Pre-Flight Connection
        await pool.query('SELECT 1');
        console.log(`[${new Date().toISOString()}] [SUCCESS] Connection established.`);

        // 4. Migration Execution
        console.log(`[${new Date().toISOString()}] [INFO] Running Migrations...`);

        await migrate({
            dir: path.join(__dirname, '../migrations'), // Use absolute path for migrations dir too
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
