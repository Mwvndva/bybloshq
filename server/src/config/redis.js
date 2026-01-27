import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;

const createRedisClient = () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    console.log(`Initializing Redis client with URL: ${redisUrl}`);

    const client = new Redis(redisUrl, {
        // Retry strategy: wait 1s, then 2s, then 4s, etc., up to max 10s
        retryStrategy(times) {
            if (times > 10) {
                // Stop retrying after 10 attempts
                console.warn('Redis: Max retry attempts reached. Running without Redis.');
                return null; // Stop retrying
            }
            const delay = Math.min(times * 1000, 10000);
            return delay;
        },
        // Don't crash the app if Redis is unreachable immediately
        lazyConnect: true,
        maxRetriesPerRequest: null, // Don't limit retries per request (let retryStrategy handle it)
        enableOfflineQueue: true, // Queue commands when offline (prevents startup crash)
    });

    client.on('error', (err) => {
        // Suppress connection refused errors to avoid log spam in development if Redis isn't running
        if (err.code === 'ECONNREFUSED') {
            // Only log once, not repeatedly
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
        client._connectionRefusedLogged = false; // Reset the flag on successful connection
    });

    client.on('ready', () => {
        console.log('Redis client is ready to accept commands');
    });

    // Attempt to connect, but don't crash if it fails
    client.connect().catch((err) => {
        console.warn('Redis initial connection failed:', err.message);
        console.warn('Application will continue without Redis. Rate limiting will use memory store.');
    });

    return client;
};

// Singleton pattern for the client
export const getRedisClient = () => {
    if (!redisClient) {
        redisClient = createRedisClient();
    }
    return redisClient;
};

export default getRedisClient;
