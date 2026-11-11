import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Ownership = sequelize.define('Ownership', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  parcelId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'parcel_id' },
  ownerId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'owner_id' },
  sharePercent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 100, field: 'share_percent' },
  isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_current' },
  acquiredAt: { type: DataTypes.DATE, allowNull: true, field: 'acquired_at' },
  endedAt: { type: DataTypes.DATE, allowNull: true, field: 'ended_at' },
}, { tableName: 'ownerships', underscored: true, timestamps: true });

export default Ownership;
