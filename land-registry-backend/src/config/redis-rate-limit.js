import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
const client = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 }) : null;
export function createRateLimitStore(prefix) {
  if (!client) return undefined;
  return new RedisStore({ prefix: `lrc:${prefix}:`, sendCommand: (...args) => client.call(...args) });
}