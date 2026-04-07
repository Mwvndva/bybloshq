import { pool } from './server/src/config/database.js';

async function check() {
    try {
        const res = await pool.query("SELECT id, shop_name, physical_address, latitude, longitude FROM sellers WHERE shop_name = 'roy1' OR id = (SELECT seller_id FROM product_orders WHERE order_number = 'BYB-R85F6Q')");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

check();
