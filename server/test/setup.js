import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment configuration
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

process.env.NODE_ENV = 'test';
