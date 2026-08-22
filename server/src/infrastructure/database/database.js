import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../../shared/utils/logger.js';

dotenv.config();

const { Pool } = pg;
/** @type {import('pg').Pool} */
let pool;

// Required environment variables for database
const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  const errorMsg = `❌ FATAL: Missing required environment variables: ${missingVars.join(', ')}`;
  logger.error(errorMsg);
  logger.error('In production, you must use individual DB_* variables.');
  throw new Error(errorMsg);
}

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number.parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // SSL is required in production and for Render/Heroku/AWS Postgres.
  // Supports DB_SSL_REJECT_UNAUTHORIZED and DB_SSL_CA overrides for certificate trust verification.
  ssl: process.env.DB_SSL === 'false' ? false : (process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
    ca: process.env.DB_SSL_CA ? process.env.DB_SSL_CA.replace(/\\n/g, '\n') : undefined,
  } : false),

  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: process.env.NODE_ENV === 'production' ? 100 : 25,
  query_timeout: 30000,
  allowExitOnIdle: false,
};
// Fail-fast safety guard when running in test mode
if (process.env.NODE_ENV === 'test') {
  const dbName = String(process.env.DB_NAME || '');
  const dbHost = String(process.env.DB_HOST || '');
  const dbUrl = String(process.env.DATABASE_URL || '');

  const isProdHost = dbHost.includes('render.com') || dbHost.includes('amazonaws.com') || dbUrl.includes('render.com');
  const isSafeTestDb = dbName.endsWith('_test') || dbName.includes('test');

  if (isProdHost) {
    const errMsg = `FATAL SAFETY GUARD: Production DB host detected ("${dbHost}"). Refusing to connect in test mode!`;
    logger.error(errMsg);
    throw new Error(errMsg);
  }

  if (!isSafeTestDb) {
    const errMsg = `FATAL SAFETY GUARD: DB_NAME "${dbName}" is NOT a test database (must contain "test"). Refusing to connect.`;
    logger.error(errMsg);
    throw new Error(errMsg);
  }
}

// Log connection attempt details (masking password)
logger.info(`Initializing database pool: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database} (SSL: ${!!dbConfig.ssl})`);

pool = new Pool(dbConfig);

export { pool };

// Event listeners for the pool
pool.on('connect', () => {
  logger.info('Successfully connected to the database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  // Removed process.exit(-1) to prevent aggressive crashes on minor network blips
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    const queryConfig = (typeof text === 'object' && text !== null) ? text : { text, values: params };
    logger.debug('Executing query:', { text: queryConfig.text || text, name: queryConfig.name, params: queryConfig.values || params });
    const res = await pool.query(queryConfig);
    const duration = Date.now() - start;
    logger.debug('Query executed successfully', {
      text: queryConfig.text || text,
      name: queryConfig.name,
      duration: `${duration}ms`,
      rows: res.rowCount
    });
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    const qText = typeof text === 'object' ? text?.text : text;
    const qName = typeof text === 'object' ? text?.name : undefined;

    error.queryText = qText;
    error.queryDurationMs = duration;

    logger.error('Database query error:', {
      error: error.message,
      code: error.code,
      detail: error.detail,
      query: qText,
      name: qName,
      duration: `${duration}ms`,
      params: (typeof text === 'object' ? text?.values : params)
    });
    throw error;
  }
};

// Test database connection on startup
export const testConnection = async () => {
  try {
    logger.info('Testing database connection...');
    const result = await pool.query('SELECT NOW()');
    logger.info('Database connection successful. Current time:', result.rows[0].now);
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    throw error;
  }
};
