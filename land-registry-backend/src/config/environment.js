import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repositoryRoot = path.resolve(backendRoot, '..');
dotenv.config({
  path: [
    path.join(backendRoot, '.env.local'),
    path.join(backendRoot, '.env'),
    path.join(repositoryRoot, '.env.local'),
    path.join(repositoryRoot, '.env'),
  ],
});

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};
const toBool = (value, fallback) =>
  value === undefined ? fallback : ['true', '1', 'yes'].includes(String(value).toLowerCase());
const optionalNonEmpty = (schema) => z.preprocess((value) => value === '' ? undefined : value, schema.optional());
const databaseUrlName = (() => {
  if (!process.env.DATABASE_URL) return '';
  try {
    return decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1));
  } catch {
    return '';
  }
})();

const rawEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  FRONTEND_URL: optionalNonEmpty(z.string().url()),
  GOOGLE_CLIENT_ID: optionalNonEmpty(z.string()),
  SMTP_HOST: optionalNonEmpty(z.string()), SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalNonEmpty(z.string()), SMTP_PASSWORD: optionalNonEmpty(z.string()), SMTP_FROM: optionalNonEmpty(z.string().email()),
  REDIS_URL: optionalNonEmpty(z.string().url()),
  REQUIRE_EMAIL_VERIFICATION: z.enum(['true','false']).optional(),
  MFA_ENCRYPTION_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: optionalNonEmpty(z.string()),
  TURNSTILE_HOSTNAMES: optionalNonEmpty(z.string()),
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
  frontendUrl: parsed.FRONTEND_URL || 'http://localhost:5173',
  googleClientId: parsed.GOOGLE_CLIENT_ID,
  email: Object.freeze({ required: parsed.REQUIRE_EMAIL_VERIFICATION ? parsed.REQUIRE_EMAIL_VERIFICATION === 'true' : isProduction, host: parsed.SMTP_HOST, port: parsed.SMTP_PORT, user: parsed.SMTP_USER, password: parsed.SMTP_PASSWORD, from: parsed.SMTP_FROM }),
  redisUrl: parsed.REDIS_URL,
  turnstile: Object.freeze({
    secretKey: parsed.TURNSTILE_SECRET_KEY,
    hostnames: (process.env.TURNSTILE_HOSTNAMES || (parsed.FRONTEND_URL ? new URL(parsed.FRONTEND_URL).hostname : ''))
      .split(',').map((hostname) => hostname.trim()).filter(Boolean),
  }),
  mfaEncryptionKey: parsed.MFA_ENCRYPTION_KEY,
  // Render terminates TLS at its edge proxy and forwards one trusted hop.
  // Keep local development direct unless explicitly configured.
  trustProxy: toInt(process.env.TRUST_PROXY, nodeEnv === 'production' ? 1 : 0),
  bodyLimit: process.env.BODY_LIMIT || '1mb',
  db: Object.freeze({
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 5432),
    name:
      nodeEnv === 'test'
        ? databaseUrlName || process.env.DB_NAME_TEST || `${process.env.DB_NAME || 'land_registry_chain'}_test`
        : databaseUrlName || process.env.DB_NAME || 'land_registry_chain',
    user: process.env.DB_USER || 'postgres',
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
  throw new Error('In NODE_ENV=test the configured PostgreSQL database must end with "_test" (set DB_NAME_TEST or use a test DATABASE_URL)');
}

// Fail fast in production if critical settings are missing (names only - never print values).
if (isProduction) {
  const missing = [
    ...(!process.env.DATABASE_URL ? ['DB_NAME', 'DB_USER', 'DB_PASSWORD'].filter((name) => !process.env[name]) : []),
    ...['CORS_ORIGINS', 'JWT_ACCESS_SECRET', 'FRONTEND_URL', 'REDIS_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'MFA_ENCRYPTION_KEY'].filter((name) => !process.env[name]),
  ];
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }
  if (env.auth.accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters in production');
  }
  if (!env.email.required) throw new Error('REQUIRE_EMAIL_VERIFICATION must not be false in production');
  if (!/^[0-9a-fA-F]{64}$/.test(env.mfaEncryptionKey || '')) throw new Error('MFA_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)');
  if (env.cors.origins.includes('*')) {
    throw new Error('CORS_ORIGINS must not contain "*" in production');
  }
  const missingStorage = ['S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].filter((name) => !process.env[name]);
  if (missingStorage.length > 0) {
    throw new Error(`Missing required production document storage settings: ${missingStorage.join(', ')}`);
  }
}

export default env;
