-- Run once as a MySQL administrator:
--   mysql -u root -p < database/setup.sql
-- Replace both placeholder passwords below, then put the SAME values in your
-- local .env (DB_PASSWORD / DB_MIGRATION_PASSWORD). Never commit real passwords.

CREATE DATABASE IF NOT EXISTS land_registry_chain
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS land_registry_chain_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Runtime account used by the running API (no schema-management privileges).
CREATE USER IF NOT EXISTS 'lrc_app'@'127.0.0.1'
  IDENTIFIED BY 'CHANGE_ME_RUNTIME_PASSWORD';

-- Migration account used only by sequelize-cli (never by the running API).
CREATE USER IF NOT EXISTS 'lrc_migrator'@'127.0.0.1'
  IDENTIFIED BY 'CHANGE_ME_MIGRATION_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE
  ON land_registry_chain.* TO 'lrc_app'@'127.0.0.1';

GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE
  ON land_registry_chain_test.* TO 'lrc_app'@'127.0.0.1';

GRANT ALL PRIVILEGES
  ON land_registry_chain.* TO 'lrc_migrator'@'127.0.0.1';

GRANT ALL PRIVILEGES
  ON land_registry_chain_test.* TO 'lrc_migrator'@'127.0.0.1';

FLUSH PRIVILEGES;
