import { Sequelize } from 'sequelize';
import env from './environment.js';

const connection = env.db.url || {
  database: env.db.name,
  username: env.db.user,
  password: env.db.password,
  host: env.db.host,
  port: env.db.port,
};

export const sequelize = new Sequelize(connection, {
  dialect: 'postgres',
  logging: env.db.logging ? (sql) => console.log(`[sql] ${sql}`) : false,
  pool: env.db.pool,
  timezone: '+00:00', // store everything in UTC
  dialectOptions: {
    ...(env.db.url ? { ssl: { require: true, rejectUnauthorized: true } } : {}),
    connectionTimeoutMillis: 10000,
  },
  define: {
    underscored: true,
    timestamps: true,
  },
});

/** Single connectivity check. Never throws; returns { ok, error? }. */
export async function testConnection() {
  try {
    await sequelize.authenticate();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/** Tries to connect several times before giving up. Returns true/false. */
export async function connectWithRetry(
  retries = env.db.connectRetries,
  delayMs = env.db.connectRetryDelayMs
) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const result = await testConnection();
    if (result.ok) {
      console.log(`[db] Connected to PostgreSQL${env.db.url ? ' using DATABASE_URL' : ` at ${env.db.host}:${env.db.port}/${env.db.name}`}`);
      return true;
    }
    console.error(`[db] Connection attempt ${attempt}/${retries} failed: ${result.error}`);
    if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

export async function closeConnection() {
  try {
    await sequelize.close();
  } catch (error) {
    console.error(`[db] Error while closing connection: ${error.message}`);
  }
}

// NOTE: schema changes happen ONLY through migrations. We deliberately never call
// sequelize.sync({ force: true }) or { alter: true } anywhere, so records can't be wiped.
