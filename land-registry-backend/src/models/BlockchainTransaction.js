import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const BlockchainTransaction = sequelize.define('BlockchainTransaction', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  entityType: { type: DataTypes.STRING(60), allowNull: false, field: 'entity_type' },
  entityId: { type: DataTypes.BIGINT, allowNull: false, field: 'entity_id' },
  action: { type: DataTypes.STRING(60), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'submitted', 'confirmed', 'failed'), allowNull: false, defaultValue: 'pending' },
  txHash: { type: DataTypes.STRING(66), allowNull: true, field: 'tx_hash' },
  blockNumber: { type: DataTypes.BIGINT, allowNull: true, field: 'block_number' },
  confirmedAt: { type: DataTypes.DATE, allowNull: true, field: 'confirmed_at' },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  nextAttemptAt: { type: DataTypes.DATE, allowNull: true, field: 'next_attempt_at' },
  lastError: { type: DataTypes.TEXT, allowNull: true, field: 'last_error' },
  payload: { type: DataTypes.JSON, allowNull: true },
}, { tableName: 'blockchain_transactions', underscored: true, timestamps: true });

export default BlockchainTransaction;
