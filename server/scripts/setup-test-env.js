// Generates server/.env.test from server/.env.test.example if it doesn't exist,
// so a fresh clone (or CI) has a working test configuration without committing
// the real (gitignored) .env.test. Idempotent: never overwrites an existing file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, '../.env.test');
const example = path.resolve(__dirname, '../.env.test.example');

if (fs.existsSync(target)) {
  console.log('✓ server/.env.test already exists — leaving it untouched.');
  process.exit(0);
}

if (!fs.existsSync(example)) {
  console.error('✗ server/.env.test.example is missing; cannot bootstrap .env.test.');
  process.exit(1);
}

fs.copyFileSync(example, target);
console.log('✓ Created server/.env.test from .env.test.example.');
console.log('  Adjust secrets/URLs as needed before running integration tests.');
