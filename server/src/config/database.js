import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

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
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // SSL is required in production and for Render/Heroku Postgres
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: process.env.NODE_ENV === 'production' ? 100 : 25,
  query_timeout: 30000,
  allowExitOnIdle: false,
};

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
    logger.debug('Executing query:', { text, params });
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed successfully', {
      text,
      duration: `${duration}ms`,
      rows: res.rowCount
    });
    return res;
  } catch (error) {
    logger.error('Database query error:', {
      error: error.message,
      code: error.code,
      detail: error.detail,
      query: text,
      params
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
