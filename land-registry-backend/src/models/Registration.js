import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Registration = sequelize.define('Registration', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  parcelId: { type: DataTypes.BIGINT, allowNull: false, field: 'parcel_id' },
  applicantId: { type: DataTypes.BIGINT, allowNull: false, field: 'applicant_id' },
  status: { type: DataTypes.ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected'), allowNull: false, defaultValue: 'submitted' },
  reviewedBy: { type: DataTypes.BIGINT, allowNull: true, field: 'reviewed_by' },
  reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
  decisionNotes: { type: DataTypes.TEXT, allowNull: true, field: 'decision_notes' },
}, { tableName: 'registrations', underscored: true, timestamps: true });

export default Registration;
