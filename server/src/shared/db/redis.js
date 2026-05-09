import dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config();

let redisClient = null;
const require = createRequire(import.meta.url);
let Redis = null;

try {
    Redis = require('ioredis');
} catch (error) {
    console.warn('[Redis] ioredis unavailable; using in-memory no-op Redis fallback', error.message);
}

const createFallbackRedisClient = () => {
    const store = new Map();
    const expirations = new Map();
    const cleanup = (key) => {
        const expiresAt = expirations.get(key);
        if (expiresAt && expiresAt <= Date.now()) {
            store.delete(key);
            expirations.delete(key);
        }
    };
    const setExpiryFromArgs = (key, args) => {
        const exIndex = args.findIndex(arg => String(arg).toUpperCase() === 'EX');
        if (exIndex >= 0 && args[exIndex + 1]) {
            expirations.set(key, Date.now() + Number(args[exIndex + 1]) * 1000);
        }
    };
    return {
        async connect() {},
        on() {},
        async get(key) {
            cleanup(key);
            return store.get(key) ?? null;
        },
        async set(key, value, ...args) {
            cleanup(key);
            const nx = args.some(arg => String(arg).toUpperCase() === 'NX');
            if (nx && store.has(key)) return null;
            store.set(key, value);
            setExpiryFromArgs(key, args);
            return 'OK';
        },
        async del(key) {
            expirations.delete(key);
            return store.delete(key) ? 1 : 0;
        },
        async incr(key) {
            cleanup(key);
            const next = Number.parseInt(store.get(key) || '0', 10) + 1;
            store.set(key, String(next));
            return next;
        },
        async expire(key, seconds) {
            expirations.set(key, Date.now() + Number(seconds) * 1000);
            return 1;
        },
        async call(command, ...args) {
            const normalized = String(command || '').toLowerCase();
            if (normalized === 'get') return this.get(args[0]);
            if (normalized === 'set') return this.set(...args);
            if (normalized === 'del') return this.del(args[0]);
            if (normalized === 'incr') return this.incr(args[0]);
            if (normalized === 'expire') return this.expire(...args);
            return null;
        }
    };
};

const createRedisClient = () => {
    if (!Redis) {
        return createFallbackRedisClient();
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    console.log(`Initializing Redis client with URL: ${redisUrl}`);

    const client = new Redis(redisUrl, {
        retryStrategy(times) {
            if (times > 10) {
                console.warn('Redis: Max retry attempts reached. Running without Redis.');
                return null;
            }
            const delay = Math.min(times * 1000, 10000);
            return delay;
        },
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
    });

    client.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
            if (!client._connectionRefusedLogged) {
                console.warn('Redis connection refused. Ensure Redis is running if you want persistence.');
                client._connectionRefusedLogged = true;
            }
        } else {
            console.error('Redis Client Error:', err.message);
        }
    });

    client.on('connect', () => {
        console.log('Redis client connected successfully');
        client._connectionRefusedLogged = false;
    });

    client.on('ready', () => {
        console.log('Redis client is ready to accept commands');
    });

    client.connect().catch((err) => {
        console.warn('Redis initial connection failed:', err.message);
    });

    return client;
};

export const getRedisClient = () => {
    if (!redisClient) {
        redisClient = createRedisClient();
    }
    return redisClient;
};

export default getRedisClient;
