import { pool } from './src/config/database.js';

const runMigration = async () => {
    try {
        console.log('Adding physical_address column to sellers table...');
        await pool.query('ALTER TABLE sellers ADD COLUMN IF NOT EXISTS physical_address TEXT');
        console.log('Column added successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error adding column:', error);
        process.exit(1);
    }
};

runMigration();
