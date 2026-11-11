import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ForensicFinding = sequelize.define('ForensicFinding', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  evidenceId: { type: DataTypes.BIGINT, allowNull: true, field: 'evidence_id' },
  parcelId: { type: DataTypes.BIGINT, allowNull: true, field: 'parcel_id' },
  caseId: { type: DataTypes.STRING(80), allowNull: false, field: 'case_id' },
  title: { type: DataTypes.STRING(160), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  finding: { type: DataTypes.TEXT, allowNull: false },
  riskLevel: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium', field: 'risk_level' },
  status: { type: DataTypes.ENUM('open', 'closed'), allowNull: false, defaultValue: 'open' },
  recordedBy: { type: DataTypes.BIGINT, allowNull: false, field: 'recorded_by' },
}, { tableName: 'forensic_findings', underscored: true, timestamps: true });

export default ForensicFinding;
