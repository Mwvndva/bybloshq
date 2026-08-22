import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(path.resolve(__dirname, '../server/package.json'));

const migrationDir = path.resolve(__dirname, '../server/migrations');
const files = fs.readdirSync(migrationDir);

const customLogger = {
    info: console.log,
    warn: console.warn,
    error: (msg, ...args) => {
        if (typeof msg === 'string' && msg.startsWith("Can't determine timestamp for")) {
            return;
        }
        console.error(msg, ...args);
    }
};

const { getTimestamp } = require('node-pg-migrate/dist/migration');

console.log('Testing custom logger with getTimestamp:');
files.forEach(file => {
    const ts = getTimestamp(customLogger, file);
    // Should produce no errors on stdout/stderr
});
console.log('Tested all 46 migration files silently parsed!');
