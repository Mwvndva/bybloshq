import { pool } from './src/config/database.js';

async function checkBuyersUserIds() {
    try {
        console.log('Checking buyers table for user_id values...\n');

        const result = await pool.query(`
      SELECT id, email, user_id 
      FROM buyers 
      ORDER BY id 
      LIMIT 10
    `);

        console.log('Buyers in database:');
        console.table(result.rows);

        const withoutUserId = result.rows.filter(b => !b.user_id);
        console.log(`\nBuyers without user_id: ${withoutUserId.length}`);

        if (withoutUserId.length > 0) {
            console.log('\nBuyers missing user_id:');
            console.table(withoutUserId);
        }

        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkBuyersUserIds();
