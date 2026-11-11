import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const EvidenceCustody = sequelize.define('EvidenceCustody', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  evidenceId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'evidence_id' },
  actorId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'actor_id' },
  action: { type: DataTypes.STRING(60), allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'evidence_custody', underscored: true, timestamps: true, updatedAt: false });

export default EvidenceCustody;
