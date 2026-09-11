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
// Full schema snapshot (structure + pgmigrations bookkeeping). Shared with the
// test tooling as the single source of truth. Used to bootstrap a genuinely
// EMPTY database, because the incremental migrations do not replay cleanly from
// zero (ordering: some early migrations reference tables created later). This
// is the same reason CI provisions from this snapshot rather than replaying.
const SCHEMA_SNAPSHOT_FILE = path.resolve(__dirname, '../test/schema.sql');

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

    // Single SSL config, shared by the pre-flight pool AND node-pg-migrate's
    // own connection below. Managed Postgres (Render, etc.) rejects non-SSL
    // connections with "SSL/TLS required" (28000); passing only a bare URL
    // string to migrate() opened an unencrypted connection and failed even
    // though the pre-flight pool connected fine. DATABASE_URL built from DB_*
    // parts carries no sslmode, so the SSL must come from here.
    const sslConfig = process.env.DB_SSL === 'false'
        ? false
        : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig,
    });

    try {
        // 3. Pre-Flight Connection
        //
        // Retried with backoff rather than a single attempt: this script now
        // runs as the very first thing a freshly-started container does
        // (server/docker-entrypoint.sh), often within milliseconds of the
        // process starting. Render's internal-hostname DNS/private networking
        // for a just-booted container isn't always ready in that first
        // instant -- the app's own server boot does enough other
        // initialization first that it doesn't usually hit this window, but
        // a script this eager to connect can lose that race and fail a
        // migration (and therefore the whole deploy) on transient
        // not-ready-yet networking rather than a real problem with the
        // database or credentials.
        const MAX_CONNECT_ATTEMPTS = 6;
        const CONNECT_RETRY_DELAY_MS = 5000;
        let lastConnectError;
        for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
            try {
                await pool.query('SELECT 1');
                lastConnectError = undefined;
                break;
            } catch (err) {
                lastConnectError = err;
                const isLastAttempt = attempt === MAX_CONNECT_ATTEMPTS;
                console.warn(
                    `[${new Date().toISOString()}] [WARN] Database connection attempt ${attempt}/${MAX_CONNECT_ATTEMPTS} failed` +
                    `${isLastAttempt ? '' : `, retrying in ${CONNECT_RETRY_DELAY_MS / 1000}s`}: ${err.message}`
                );
                if (!isLastAttempt) {
                    await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS));
                }
            }
        }
        if (lastConnectError) {
            throw lastConnectError;
        }
        console.log(`[${new Date().toISOString()}] [SUCCESS] Connection established.`);

        const hasUsers = await tableExists(pool, 'users');
        const hasPgmigrations = await tableExists(pool, 'pgmigrations');
        const hasRefundRequests = await tableExists(pool, 'refund_requests');

        if (!hasUsers && !hasPgmigrations && fs.existsSync(SCHEMA_SNAPSHOT_FILE)) {
            // FRESH / EMPTY database: incremental migrations can't build from
            // zero (ordering), so provision from the full schema snapshot — the
            // same known-good path CI uses. The snapshot also records
            // pgmigrations 1..N (and advances its sequence), so the
            // node-pg-migrate run below then applies ONLY migrations newer than
            // the snapshot. Guarded on both `users` and `pgmigrations` being
            // absent so this only ever fires on a truly empty database.
            console.log(`[${new Date().toISOString()}] [INFO] Empty database detected — applying full schema snapshot (test/schema.sql) to bootstrap...`);
            const snapshotSql = fs.readFileSync(SCHEMA_SNAPSHOT_FILE, 'utf8');
            await pool.query(snapshotSql);
            console.log(`[${new Date().toISOString()}] [SUCCESS] Schema snapshot applied; incremental migrations newer than the snapshot (if any) will run next.`);
        } else if (hasUsers && !hasRefundRequests && fs.existsSync(UNIFIED_SCHEMA_FILE)) {
            console.log(`[${new Date().toISOString()}] [INFO] Applying unified runtime schema bootstrap...`);
            const unifiedSchemaSql = fs.readFileSync(UNIFIED_SCHEMA_FILE, 'utf8');
            await pool.query(unifiedSchemaSql);
            console.log(`[${new Date().toISOString()}] [SUCCESS] Unified runtime schema bootstrap applied.`);
        }

        // 4. Migration Execution
        console.log(`[${new Date().toISOString()}] [INFO] Running Migrations...`);

        await migrate({
            dir: path.resolve(__dirname, '../migrations'), // Ensure absolute path to migrations folder
            direction: 'up',
            migrationsTable: 'pgmigrations',
            // Pass a pg ClientConfig (not a bare string) so node-pg-migrate's
            // connection uses the same SSL settings as the pre-flight pool.
            databaseUrl: { connectionString: process.env.DATABASE_URL, ssl: sslConfig },
            // Refuses to run if the migrations directory's sort order ever
            // diverges from the DB's real historical run_on order again (see
            // migrations/ filenames: all now normalized to a real 14-digit
            // YYYYMMDDHHMMSS prefix so node-pg-migrate's own timestamp
            // parser -- which only special-cases 13/17-digit prefixes -- sorts
            // them correctly; any format regression now fails loudly here
            // instead of being silently tolerated).
            checkOrder: true,
            verbose: true,
            logger: {
                info: console.log,
                warn: console.warn,
                error: (msg, ...args) => {
                    if (typeof msg === 'string' && msg.startsWith("Can't determine timestamp for")) {
                        return;
                    }
                    console.error(msg, ...args);
                }
            }
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
