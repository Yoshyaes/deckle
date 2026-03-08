import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.ping();
    console.log('Redis connected');
  } catch (err) {
    console.error('Redis connection failed:', err);
  }
}
