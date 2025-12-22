
import { pool } from './src/config/database.js';

const checkProduct = async () => {
    try {
        const res = await pool.query("SELECT id, name, is_digital, digital_file_name FROM products WHERE name ILIKE '%sundress%'");
        console.log('Product check result:', res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkProduct();
