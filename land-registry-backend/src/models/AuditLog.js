import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  actorId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'actor_id' },
  action: { type: DataTypes.STRING(80), allowNull: false },
  entityType: { type: DataTypes.STRING(60), allowNull: false, field: 'entity_type' },
  entityId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'entity_id' },
  requestId: { type: DataTypes.STRING(64), allowNull: true, field: 'request_id' },
  ip: { type: DataTypes.STRING(64), allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
}, { tableName: 'audit_logs', underscored: true, timestamps: true, updatedAt: false });

export default AuditLog;
