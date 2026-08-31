import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRedisClient } from '../src/shared/config/redis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment configuration
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

process.env.NODE_ENV = 'test';
process.env.SKIP_AUTH_RATE_LIMIT = 'true';

// Stub the Redis client so unit/contract tests never need a Redis daemon.
// Integration tests that want a real test-Redis can opt out with
// USE_REAL_REDIS=true (and a REDIS_URL pointing at the test instance).
if (process.env.USE_REAL_REDIS !== 'true') {
  const redis = getRedisClient();
  redis.status = 'ready';
  redis.call = async (cmd, ...args) => {
    const norm = String(cmd || '').toLowerCase();
    if (norm === 'eval' || norm === 'script') return 'OK';
    if (norm === 'get') return redis.get ? redis.get(args[0]) : null;
    if (norm === 'set') return redis.set ? redis.set(...args) : 'OK';
    if (norm === 'del') return redis.del ? redis.del(args[0]) : 1;
    return 'OK';
  };
}
