import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Log database connection details (without password)
console.log('Connecting to database:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? '***' : undefined,
});

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000, // 5 seconds timeout for connection
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
  max: 20, // max number of clients in the pool
});

// Test the connection when the pool is created
pool.on('connect', () => {
  console.log('Successfully connected to the database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text, params) => {
  const start = Date.now();
  const client = await pool.connect();
  try {
    console.log('Executing query:', { text, params });
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executed successfully', { 
      text, 
      duration: `${duration}ms`,
      rows: res.rowCount 
    });
    return res;
  } catch (error) {
    console.error('Database query error:', {
      error: error.message,
      code: error.code,
      detail: error.detail,
      query: text,
      params
    });
    throw error;
  } finally {
    client.release();
  }
};

// Test database connection on startup
export const testConnection = async () => {
  try {
    console.log('Testing database connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful. Current time:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    throw error;
  }
};
