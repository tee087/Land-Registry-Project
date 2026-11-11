// Used ONLY by sequelize-cli (migrations/seeders). The app itself uses src/config/database.js.
// CommonJS (.cjs) because the project is "type": "module".
const path = require('node:path');
const backendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
require('dotenv').config({
  path: [
    path.join(backendRoot, '.env.local'),
    path.join(backendRoot, '.env'),
    path.join(repositoryRoot, '.env.local'),
    path.join(repositoryRoot, '.env'),
  ],
});

const migrationUrl = process.env.DATABASE_URL_UNPOOLED
  ? 'DATABASE_URL_UNPOOLED'
  : process.env.DATABASE_URL
    ? 'DATABASE_URL'
    : undefined;

const base = {
  use_env_variable: migrationUrl,
  username: process.env.DB_MIGRATION_USER || process.env.DB_USER,
  password: process.env.DB_MIGRATION_PASSWORD || process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
  dialectOptions: migrationUrl ? { ssl: { require: true, rejectUnauthorized: true } } : {},
};

module.exports = {
  development: base,
  test: { ...base, database: process.env.DB_NAME_TEST || `${process.env.DB_NAME}_test` },
  production: base,
};
