import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('Connecting to database...');
console.log('DB Host:', process.env.DB_HOST);
console.log('DB Port:', process.env.DB_PORT);
console.log('DB Name:', process.env.DB_NAME);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000,
});

async function checkPayoutsSchema() {
  console.log('Starting schema check...');
  const client = await pool.connect().catch(err => {
    console.error('Error connecting to database:', err);
    process.exit(1);
  });
  
  try {
    console.log('Connected to database. Checking if payouts table exists...');
    
    // First check if the table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'payouts'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.error('Error: payouts table does not exist in the database');
      return;
    }
    
    console.log('Payouts table exists. Checking columns...');
    
    // Check table structure
    const { rows: columns } = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_name = 'payouts'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nPayouts table columns:');
    console.table(columns);
    
    // Check constraints
    console.log('\nChecking constraints...');
    try {
      const { rows: constraints } = await client.query(`
        SELECT 
          conname as constraint_name,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint 
        WHERE conrelid = 'payouts'::regclass;
      `);
      
      if (constraints.length > 0) {
        console.log('\nConstraints:');
        console.table(constraints);
      } else {
        console.log('No constraints found on payouts table');
      }
      
    } catch (constError) {
      console.error('Error checking constraints:', constError);
    }
    
  } catch (error) {
    console.error('Error checking payouts schema:', error);
  } finally {
    console.log('Releasing database connection...');
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

checkPayoutsSchema()
  .then(() => console.log('Schema check completed'))
  .catch(err => console.error('Fatal error:', err));
