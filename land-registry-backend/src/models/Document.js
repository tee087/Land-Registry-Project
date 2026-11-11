import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Document = sequelize.define('Document', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  parcelId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'parcel_id' },
  registrationId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'registration_id' },
  uploadedBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'uploaded_by' },
  originalName: { type: DataTypes.STRING(255), allowNull: false, field: 'original_name' },
  storageKey: { type: DataTypes.STRING(255), allowNull: false, field: 'storage_key' },
  mimeType: { type: DataTypes.STRING(120), allowNull: false, field: 'mime_type' },
  sizeBytes: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'size_bytes' },
  sha256: { type: DataTypes.CHAR(64), allowNull: false },
  version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_current' },
}, { tableName: 'documents', underscored: true, timestamps: true });

export default Document;
