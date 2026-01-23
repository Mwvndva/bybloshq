import { pool } from './src/config/database.js';

const runMigration = async () => {
    try {
        console.log('Adding location coordinates to sellers table...');
        await pool.query('ALTER TABLE sellers ADD COLUMN IF NOT EXISTS latitude FLOAT, ADD COLUMN IF NOT EXISTS longitude FLOAT');
        console.log('Columns latitude and longitude added successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error adding columns:', error);
        process.exit(1);
    }
};

runMigration();
