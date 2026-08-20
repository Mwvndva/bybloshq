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
const UNIFIED_SCHEMA_FILE = path.resolve(__dirname, '../migrations/20260814195000_unified_runtime_schema.sql');

// Task 1: Correct the Import using createRequire for robust CJS handling
const migrate = require('node-pg-migrate').default || require('node-pg-migrate');

// Task 1: Absolute Path Loading & Task 2: Debugging
let envPath;
if (process.env.DOTENV_CONFIG_PATH) {
    envPath = path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH);
} else if (process.env.NODE_ENV === 'test') {
    envPath = path.resolve(__dirname, '../.env.test');
} else {
    envPath = path.resolve(__dirname, '../.env');
    if (!fs.existsSync(envPath)) {
        envPath = path.resolve(__dirname, '../.env.production');
    }
}
const envExists = fs.existsSync(envPath);

console.log('--- Pre-flight Check ---');
console.log(`CWD: ${process.cwd()}`);
console.log(`Resolved .env path: ${envPath}`);
console.log(`.env exists: ${envExists}`);
console.log('------------------------');

// Load .env explicitly
dotenv.config({ path: envPath, override: true });

const { Pool } = pg;

async function tableExists(pool, tableName) {
    const { rowCount } = await pool.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = $1`,
        [tableName]
    );
    return rowCount > 0;
}

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

        const hasUsers = await tableExists(pool, 'users');
        const hasRefundRequests = await tableExists(pool, 'refund_requests');
        if (hasUsers && !hasRefundRequests && fs.existsSync(UNIFIED_SCHEMA_FILE)) {
            console.log(`[${new Date().toISOString()}] [INFO] Applying unified runtime schema bootstrap...`);
            const unifiedSchemaSql = fs.readFileSync(UNIFIED_SCHEMA_FILE, 'utf8');
            await pool.query(unifiedSchemaSql);
            console.log(`[${new Date().toISOString()}] [SUCCESS] Unified runtime schema bootstrap applied.`);
        }

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
