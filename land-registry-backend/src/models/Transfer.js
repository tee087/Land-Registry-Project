import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Transfer = sequelize.define('Transfer', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  parcelId: { type: DataTypes.BIGINT, allowNull: false, field: 'parcel_id' },
  fromOwnerId: { type: DataTypes.BIGINT, allowNull: false, field: 'from_owner_id' },
  toOwnerId: { type: DataTypes.BIGINT, allowNull: false, field: 'to_owner_id' },
  initiatedBy: { type: DataTypes.BIGINT, allowNull: false, field: 'initiated_by' },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  reviewedBy: { type: DataTypes.BIGINT, allowNull: true, field: 'reviewed_by' },
  reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'transfers', underscored: true, timestamps: true });

export default Transfer;
