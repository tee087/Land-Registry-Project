// Used ONLY by sequelize-cli (migrations/seeders). The app itself uses src/config/database.js.
// CommonJS (.cjs) because the project is "type": "module".
require('dotenv').config();

const base = {
  use_env_variable: process.env.DATABASE_URL ? 'DATABASE_URL' : undefined,
  username: process.env.DB_MIGRATION_USER || process.env.DB_USER,
  password: process.env.DB_MIGRATION_PASSWORD || process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
  dialectOptions: process.env.DATABASE_URL ? { ssl: { require: true, rejectUnauthorized: true } } : {},
};

module.exports = {
  development: base,
  test: { ...base, database: process.env.DB_NAME_TEST || `${process.env.DB_NAME}_test` },
  production: base,
};
