import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 500, 5000);
    console.warn(`[Feed Service] Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('[Feed Service] Redis connected');
});

redis.on('error', (err) => {
  console.error('[Feed Service] Redis error:', err);
});

redis.on('ready', () => {
  console.log('[Feed Service] Redis ready');
});

export { redis };
