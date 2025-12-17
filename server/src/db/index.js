import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3001,
  database: process.env.DB_NAME || 'byblos6',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'nurubot',
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Log database connection details
console.log('Database connection details:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  hasPassword: !!dbConfig.password,
});

// Create a new pool using the configuration
const pool = new Pool(dbConfig);

// Test the database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to the database');
    client.release();
  } catch (error) {
    console.error('Error connecting to the database:', error);
    process.exit(1);
  }
};

// Execute the connection test
testConnection();

// Export the pool for use in other files
export default pool;

// Helper function to execute a query
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error executing query:', { text, error });
    throw error;
  }
};

// Export a method to get a client from the pool
export const getClient = async () => {
  const client = await pool.connect();
  
  // Set a timeout of 5 seconds for queries
  const query = client.query;
  const release = client.release;
  
  // Set a timeout on the client
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
    console.error(`The last executed query on this client was: ${client.lastQuery}`);
  }, 5000);
  
  // Monkey patch the query method to keep track of the last query executed
  client.query = (...args) => {
    client.lastQuery = args[0];
    return query.apply(client, args);
  };
  
  // Override the release method to clear the timeout and reset the client
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };
  
  return client;
};
