import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config/index.js';

const redisClient = config.REDIS_URL
  ? createClient({ url: config.REDIS_URL })
  : null;

if (redisClient) {
  redisClient.connect().catch((err) => {
    console.error('Failed to connect to Redis for Rate Limiting:', err);
  });
}

const store = redisClient
  ? new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    })
  : undefined;

export const standardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 1 minute)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' } },
  store,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // Limit each IP to 10 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many authentication attempts, please try again later.' } },
  store,
});

