import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const LandParcel = sequelize.define('LandParcel', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  parcelNumber: { type: DataTypes.STRING(80), allowNull: false, unique: true, field: 'parcel_number', set(value) { this.setDataValue('parcelNumber', value?.trim().toUpperCase()); } },
  county: { type: DataTypes.STRING(80), allowNull: false },
  block: { type: DataTypes.STRING(80), allowNull: true },
  location: { type: DataTypes.STRING(160), allowNull: true },
  areaHectares: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'area_hectares' },
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  status: { type: DataTypes.ENUM('active', 'frozen', 'disputed', 'archived'), allowNull: false, defaultValue: 'active' },
  registeredBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'registered_by' },
}, { tableName: 'land_parcels', underscored: true, timestamps: true });

export default LandParcel;
