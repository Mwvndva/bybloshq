
import { pool } from '../config/database.js';

const addMetadataColumn = async () => {
    const client = await pool.connect();
    try {
        console.log('Adding metadata column to withdrawal_requests table...');

        await client.query(`
            ALTER TABLE withdrawal_requests 
            ADD COLUMN IF NOT EXISTS metadata JSONB;
        `);

        console.log('Successfully added metadata column.');
    } catch (error) {
        console.error('Error adding metadata column:', error);
    } finally {
        client.release();
        await pool.end();
    }
};

addMetadataColumn();
