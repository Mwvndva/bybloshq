import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const username = process.env.PAYD_USERNAME;
const password = process.env.PAYD_PASSWORD;
const networkCode = process.env.PAYD_NETWORK_CODE;
const channelId = process.env.PAYD_CHANNEL_ID;
const baseUrl = process.env.PAYD_BASE_URL || 'https://api.mypayd.app/api/v3';

const authString = `${username}:${password}`;
const base64Auth = Buffer.from(authString).toString('base64');

// Construct Payout Payload
const payload = JSON.stringify({
    username: username, // Payouts seem to use env username?
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
});

// Write payload to specific absolute path to avoid cwd issues
const payloadPath = join(__dirname, 'payload_payout.json');
fs.writeFileSync(payloadPath, payload);

// Use @ syntax for curl to read from file
const curlCommand = `curl -s -w "\\nHTTP_STATUS:%{http_code}" -X POST "${baseUrl}/withdrawal" -H "Content-Type: application/json" -H "Authorization: Basic ${base64Auth}" -d "@${payloadPath}"`;

console.log("Executing Curl Command for Payout...");

exec(curlCommand, (error, stdout, stderr) => {
    // Cleanup
    try { fs.unlinkSync(payloadPath); } catch (e) { }

    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    console.log(`OUTPUT_START\n${stdout}\nOUTPUT_END`);
});
