
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from one level up
dotenv.config({ path: join(__dirname, '../.env') });

const username = process.env.PAYD_USERNAME;
const password = process.env.PAYD_PASSWORD;
const networkCode = process.env.PAYD_NETWORK_CODE;

console.log('--- DBG: CREDENTIALS CHECK ---');
console.log('PAYD_USERNAME:', username ? `"${username}" (len=${username.length})` : 'MISSING');
// Don't show password, just checking length/existence
console.log('PAYD_PASSWORD:', password ? `[HIDDEN] (len=${password.length})` : 'MISSING');
console.log('PAYD_NETWORK_CODE:', networkCode ? `"${networkCode}" (len=${networkCode.length})` : 'MISSING');

if (!username || !password) {
    console.error('Missing credentials');
    process.exit(1);
}

const authString = `${username}:${password}`;
const base64Auth = Buffer.from(authString).toString('base64');
console.log('Auth Header generated successfully.');
