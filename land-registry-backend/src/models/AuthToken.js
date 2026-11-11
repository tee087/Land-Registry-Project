import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
const AuthToken = sequelize.define('AuthToken', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id' },
  tokenHash: { type: DataTypes.CHAR(64), allowNull: false, unique: true, field: 'token_hash' },
  purpose: { type: DataTypes.ENUM('email_verification', 'password_reset'), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  usedAt: { type: DataTypes.DATE, allowNull: true, field: 'used_at' },
}, { tableName: 'auth_tokens', updatedAt: false });
export default AuthToken;
