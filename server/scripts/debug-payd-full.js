
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const config = {
    username: process.env.PAYD_USERNAME,
    password: process.env.PAYD_PASSWORD,
    network_code: process.env.PAYD_NETWORK_CODE,
    channel_id: process.env.PAYD_CHANNEL_ID,
    base_url: process.env.PAYD_BASE_URL || 'https://api.mypayd.app/api/v3'
};

const getAuthHeader = () => {
    const authString = `${config.username}:${config.password}`;
    return `Basic ${Buffer.from(authString).toString('base64')}`;
};

const testCases = [
    { name: "Env Username", username: config.username },
    { name: "Docs Username", username: "paydconsultant" },
    { name: "User Email", username: "roynthiga9@gmail.com" }, // From previous terminal logs
    { name: "Null Username", username: null }, // Test exclusion
];

const phone = "07712345678"; // Generic test phone

async function runTests() {
    console.log("--- Starting Payd Permutation Tests ---");
    console.log("Auth Username:", config.username);

    const client = axios.create({
        baseURL: config.base_url,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader()
        },
        validateStatus: () => true // Capture all statuses
    });

    for (const test of testCases) {
        console.log(`\nTesting Case: ${test.name}`);

        const payload = {
            network_code: config.network_code,
            amount: 10,
            phone_number: phone,
            account_number: `+254${phone.substring(1)}`,
            account_name: "Test User",
            channel_id: config.channel_id,
            narration: "Test Permutation",
            currency: "KES",
            transaction_channel: "mobile",
            callback_url: "https://example.com/callback",
            customer_info: {
                name: "Test User",
                email: "test@example.com",
                phone: `+254${phone.substring(1)}`,
                country: "Kenya"
            }
        };

        if (test.username) {
            payload.username = test.username;
        }

        try {
            const response = await client.post('/payments', payload);
            console.log(`Status: ${response.status}`);
            console.log(`Response:`, JSON.stringify(response.data, null, 2));

            if (response.status === 200 || response.data.status === "SUCCESS") {
                console.log("✅ SUCCESS FOUND!");
                process.exit(0);
            }
        } catch (error) {
            console.log(`Error: ${error.message}`);
        }
    }

    console.log("\n--- All Tests Completed ---");
}

runTests();
