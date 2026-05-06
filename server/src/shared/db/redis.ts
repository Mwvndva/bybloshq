import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient: any = null;

const createRedisClient = () => {
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

    client.on('error', (err: any) => {
        if (err.code === 'ECONNREFUSED') {
            // @ts-ignore
            if (!client._connectionRefusedLogged) {
                console.warn('Redis connection refused. Ensure Redis is running if you want persistence.');
                // @ts-ignore
                client._connectionRefusedLogged = true;
            }
        } else {
            console.error('Redis Client Error:', err.message);
        }
    });

    client.on('connect', () => {
        console.log('Redis client connected successfully');
        // @ts-ignore
        client._connectionRefusedLogged = false;
    });

    client.on('ready', () => {
        console.log('Redis client is ready to accept commands');
    });

    client.connect().catch((err: any) => {
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
