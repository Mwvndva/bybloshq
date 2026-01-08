
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('JWT_COOKIE_EXPIRES_IN:', process.env.JWT_COOKIE_EXPIRES_IN);
console.log('JWT_COOKIE_EXPIRES_IN type:', typeof process.env.JWT_COOKIE_EXPIRES_IN);

const expirationDays = process.env.JWT_COOKIE_EXPIRES_IN;
const expirationDate = new Date(
    Date.now() + expirationDays * 24 * 60 * 60 * 1000
);
console.log('Calculated Expiration Date:', expirationDate);
