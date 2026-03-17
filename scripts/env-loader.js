/** @ts-nocheck */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Save original console before logger might silence it in production
const originalConsoleLog = console.log;

// Try loading from root or server/ directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

// Force allow console.log for scripts even in production
if (process.env.NODE_ENV === 'production') {
    // We restore it after a short delay to ensure logger.js has finished its top-level execution
    setTimeout(() => {
        console.log = originalConsoleLog;
        console.info = originalConsoleLog;
    }, 0);
}

console.log('🔄 Environment variables loaded');
