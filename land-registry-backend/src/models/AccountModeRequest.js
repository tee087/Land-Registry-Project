import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const AccountModeRequest = sequelize.define('AccountModeRequest', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  reference: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id' },
  currentAccountType: { type: DataTypes.STRING(24), allowNull: false, field: 'current_account_type' },
  requestedAccountType: { type: DataTypes.STRING(24), allowNull: false, field: 'requested_account_type' },
  tokenHash: { type: DataTypes.CHAR(64), allowNull: false, unique: true, field: 'token_hash' },
  status: { type: DataTypes.ENUM('pending', 'approved', 'cancelled', 'expired'), allowNull: false, defaultValue: 'pending' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
}, { tableName: 'account_mode_requests', underscored: true, timestamps: true, updatedAt: false });

export default AccountModeRequest;
