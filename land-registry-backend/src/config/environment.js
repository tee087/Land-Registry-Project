import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};
const toBool = (value, fallback) =>
  value === undefined ? fallback : ['true', '1', 'yes'].includes(String(value).toLowerCase());

const rawEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
}).safeParse(process.env);
if (!rawEnv.success) throw new Error(`Invalid environment configuration: ${rawEnv.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
const parsed = rawEnv.data;
const nodeEnv = parsed.NODE_ENV;
const isProduction = nodeEnv === 'production';

const env = Object.freeze({
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: parsed.PORT,
  auth: Object.freeze({ accessSecret: process.env.JWT_ACCESS_SECRET || (nodeEnv === 'production' ? '' : 'development-only-secret-change-this-32-chars'), accessTtl: parsed.JWT_ACCESS_TTL, refreshTtlDays: parsed.REFRESH_TOKEN_TTL_DAYS, bcryptRounds: parsed.BCRYPT_ROUNDS }),
  trustProxy: toInt(process.env.TRUST_PROXY, 0),
  bodyLimit: process.env.BODY_LIMIT || '1mb',
  db: Object.freeze({
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    name:
      nodeEnv === 'test'
        ? process.env.DB_NAME_TEST || `${process.env.DB_NAME || 'land_registry_chain'}_test`
        : process.env.DB_NAME || 'land_registry_chain',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    logging: toBool(process.env.DB_LOGGING, false),
    pool: Object.freeze({
      max: toInt(process.env.DB_POOL_MAX, 10),
      min: toInt(process.env.DB_POOL_MIN, 0),
      acquire: toInt(process.env.DB_POOL_ACQUIRE_MS, 30000),
      idle: toInt(process.env.DB_POOL_IDLE_MS, 10000),
    }),
    connectRetries: toInt(process.env.DB_CONNECT_RETRIES, 3),
    connectRetryDelayMs: toInt(process.env.DB_CONNECT_RETRY_DELAY_MS, 2000),
    requireOnStartup: toBool(process.env.DB_REQUIRE_ON_STARTUP, true),
  }),
  cors: Object.freeze({
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  }),
  rateLimit: Object.freeze({
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toInt(process.env.RATE_LIMIT_MAX, 300),
  }),
});

// Safety guard: automated tests must never run against a non-test database.
if (env.isTest && !env.db.name.endsWith('_test')) {
  throw new Error('In NODE_ENV=test the database name must end with "_test" (set DB_NAME_TEST)');
}

// Fail fast in production if critical settings are missing (names only - never print values).
if (isProduction) {
  const missing = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'CORS_ORIGINS', 'JWT_ACCESS_SECRET'].filter(
    (name) => !process.env[name]
  );
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }
  if (env.auth.accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters in production');
  }
  if (env.cors.origins.includes('*')) {
    throw new Error('CORS_ORIGINS must not contain "*" in production');
  }
}

export default env;
