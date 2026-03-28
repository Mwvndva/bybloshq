import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const { Pool } = pg;
/** @type {import('pg').Pool} */
let pool;

if (process.env.DATABASE_URL) {
  logger.info('Using connection string for database pool');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('render.com') || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
    connectionTimeoutMillis: 10000, // Fail fast if no connection available after 10s
    idleTimeoutMillis: 30000,       // Keep idle connections open 30s to reduce reconnect overhead
    max: 25,                        // 25 connections for application use
    query_timeout: 30000,           // 30s query timeout
    allowExitOnIdle: false,         // Keep pool alive between requests
  });
} else {
  const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    const errorMsg = `❌ FATAL: Missing required environment variables: ${missingVars.join(', ')}`;
    logger.error(errorMsg);
    logger.error('Please ensure all required database configuration is set in your .env file');
    throw new Error(errorMsg);
  }

  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10000, // Fail fast if no connection available after 10s
    idleTimeoutMillis: 30000,       // Keep idle connections open 30s to reduce reconnect overhead
    max: 25,                        // 25 connections for application use
    query_timeout: 30000,           // 30s query timeout
    allowExitOnIdle: false,         // Keep pool alive between requests
  };

  // Log database connection details (without password)
  logger.info('Database connection details:', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    hasPassword: !!dbConfig.password,
  });

  pool = new Pool(dbConfig);
}

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
