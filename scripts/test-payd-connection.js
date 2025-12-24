import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

async function testConnection() {
    const username = process.env.PAYD_USERNAME;
    const password = process.env.PAYD_PASSWORD;

    console.log('Testing PAYD Connection...');
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    // 3. Test Status Check (GET) - Probing for correct endpoint
    const testRef = "OLC203828865eR"; // From user's previous log
    const statusVariations = [
        { name: '/transactions/:ref', url: `https://api.mypayd.app/api/v3/transactions/${testRef}` },
        { name: '/payments/:ref', url: `https://api.mypayd.app/api/v3/payments/${testRef}` },
        { name: '/transactions/status/:ref', url: `https://api.mypayd.app/api/v3/transactions/status/${testRef}` },
        { name: '/payments/status/:ref', url: `https://api.mypayd.app/api/v3/payments/status/${testRef}` },
        { name: '/transactions?reference=...', url: `https://api.mypayd.app/api/v3/transactions?reference=${testRef}` }
    ];

    for (const v of statusVariations) {
        try {
            console.log(`\n3. Testing Status Probe ${v.name}...`);
            const response = await axios.get(v.url, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            console.log('✅ Status GET Success! Status:', response.status);
            console.log('Data:', JSON.stringify(response.data, null, 2));
            break;
        } catch (error) {
            console.log(`❌ Failed ${v.name}:`, error.response ? error.response.status : error.message);
        }
    }
}

testConnection();
