import rateLimit, { MemoryStore, type Store, type Options, type IncrementResponse } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config/index.js';

const redisClient = config.REDIS_URL && process.env['NODE_ENV'] !== 'test'
  ? createClient({ url: config.REDIS_URL })
  : null;

let isRedisConnected = false;

if (redisClient) {
  redisClient.connect()
    .then(() => {
      isRedisConnected = true;
    })
    .catch((err) => {
      console.error('Failed to connect to Redis for Rate Limiting, falling back to in-memory:', err.message);
      isRedisConnected = false;
    });

  redisClient.on('connect', () => {
    isRedisConnected = true;
  });
  redisClient.on('ready', () => {
    isRedisConnected = true;
  });
  redisClient.on('error', (err) => {
    isRedisConnected = false;
  });
  redisClient.on('end', () => {
    isRedisConnected = false;
  });
}

class FallbackStore implements Store {
  private redisStore: RedisStore;
  private memoryStore: MemoryStore;

  constructor(prefix: string) {
    this.redisStore = new RedisStore({
      sendCommand: (...args: string[]) => {
        if (!redisClient || !redisClient.isOpen) {
          throw new Error('Redis not connected');
        }
        return redisClient.sendCommand(args);
      },
      prefix,
    });
    this.memoryStore = new MemoryStore();
  }

  async init(options: Options): Promise<void> {
    if (!this.redisStore.init) {
      this.memoryStore.init(options);
      return;
    }

    let timeoutId: NodeJS.Timeout | undefined;
    try {
      // Race the Redis initialization with a 2-second timeout to prevent blocking startup
      await Promise.race([
        this.redisStore.init(options),
        new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Connection timeout')), 2000);
        }),
      ]);
    } catch (err: any) {
      console.warn(`Redis rate limit store initialization deferred: ${err.message}. Rate limiting will fall back to memory until Redis is available.`);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
    this.memoryStore.init(options);
  }

  async increment(key: string): Promise<IncrementResponse> {
    if (redisClient && isRedisConnected) {
      try {
        return await this.redisStore.increment(key);
      } catch (err: any) {
        console.error('Redis rate limit increment failed, falling back to memory store:', err.message);
      }
    }
    return this.memoryStore.increment(key);
  }

  async decrement(key: string): Promise<void> {
    if (redisClient && isRedisConnected) {
      try {
        return await this.redisStore.decrement(key);
      } catch (err: any) {
        console.error('Redis rate limit decrement failed, falling back to memory store:', err.message);
      }
    }
    return this.memoryStore.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    if (redisClient && isRedisConnected) {
      try {
        return await this.redisStore.resetKey(key);
      } catch (err: any) {
        console.error('Redis rate limit resetKey failed, falling back to memory store:', err.message);
      }
    }
    return this.memoryStore.resetKey(key);
  }

  async resetAll(): Promise<void> {
    const rStore = this.redisStore as any;
    if (redisClient && isRedisConnected && typeof rStore.resetAll === 'function') {
      try {
        return await rStore.resetAll();
      } catch (err: any) {
        console.error('Redis rate limit resetAll failed, falling back to memory store:', err.message);
      }
    }
    return this.memoryStore.resetAll();
  }

  async shutdown(): Promise<void> {
    const rStore = this.redisStore as any;
    if (typeof rStore.shutdown === 'function') {
      await rStore.shutdown();
    }
    this.memoryStore.shutdown();
  }
}

export const standardLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100, 
  standardHeaders: true,
  legacyHeaders: false, 
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' } },
  store: new FallbackStore('rl:standard:'),
  passOnStoreError: true,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000, 
  limit: 10, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many authentication attempts, please try again later.' } },
  store: new FallbackStore('rl:auth:'),
  passOnStoreError: true,
});
