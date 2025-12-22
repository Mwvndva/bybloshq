
import { pool } from './src/config/database.js';

const updateProduct = async () => {
    try {
        const res = await pool.query("UPDATE products SET is_digital = true, digital_file_name = 'demo_file.pdf', digital_file_path = 'uploads/digital_products/demo_file.pdf' WHERE id = 5 RETURNING *");
        console.log('Product update result:', res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

updateProduct();
