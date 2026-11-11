import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Evidence = sequelize.define('Evidence', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  parcelId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'parcel_id' },
  custodyRef: { type: DataTypes.STRING(80), allowNull: false, unique: true, field: 'custody_ref' },
  description: { type: DataTypes.TEXT, allowNull: false },
  collectedBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'collected_by' },
  status: { type: DataTypes.ENUM('collected', 'in_custody', 'analyzed', 'released'), allowNull: false, defaultValue: 'collected' },
}, { tableName: 'evidence', underscored: true, timestamps: true });

export default Evidence;
