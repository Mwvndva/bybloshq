
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
dotenv.config({ path: join(__dirname, '../.env') });

const username = process.env.PAYD_USERNAME;
const password = process.env.PAYD_PASSWORD;
const networkCode = process.env.PAYD_NETWORK_CODE;
const channelId = process.env.PAYD_CHANNEL_ID;
const baseUrl = process.env.PAYD_BASE_URL || 'https://api.mypayd.app/api/v3';

console.log('Testing Payd Payout with credentials:', {
    username: username ? username.substring(0, 5) + '...' : 'MISSING',
    networkCode: networkCode ? 'PRESENT' : 'MISSING',
    channelId: channelId ? 'PRESENT' : 'MISSING'
});

async function testPayout() {
    const authString = `${username}:${password}`;
    const base64Auth = Buffer.from(authString).toString('base64');
    const authHeader = `Basic ${base64Auth}`;

    const payload = {
        username: username,
        network_code: networkCode,
        account_name: "Test Withdrawal",
        account_number: "07712345678",
        amount: 10,
        phone_number: "07712345678",
        channel_id: channelId,
        narration: "Test Auth Verification",
        currency: "KES",
        transaction_channel: "mobile",
        channel: "mobile",
        provider_name: "Mobile Wallet (M-PESA)",
        provider_code: "MPESA",
        callback_url: "https://example.com/callback"
    };

    try {
        console.log('Sending Payout Request...');
        const response = await axios.post(`${baseUrl}/withdrawal`, payload, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });
        console.log('Payout Response:', response.data);
    } catch (error) {
        console.error('Payout Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

testPayout();
