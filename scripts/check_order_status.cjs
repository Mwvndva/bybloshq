const { Client } = require('pg');

async function checkOrders() {
    const client = new Client({
        user: 'bybloshq_user',
        host: 'localhost',
        database: 'bybloshqdb',
        password: '', // Assuming no password on local dev
        port: 5432,
    });

    try {
        await client.connect();
        const result = await client.query(`
            SELECT 
                o.order_number, 
                o.status, 
                o.order_type, 
                o.fulfillment_type, 
                o.location_address, 
                o.location_lat, 
                o.location_lng,
                o.buyer_id,
                b.full_name as buyer_name,
                b.full_address as buyer_saved_address,
                b.latitude as buyer_saved_lat,
                b.longitude as buyer_saved_lng
            FROM product_orders o
            JOIN buyers b ON o.buyer_id = b.id
            ORDER BY o.created_at DESC
            LIMIT 5
        `);
        console.table(result.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkOrders();
