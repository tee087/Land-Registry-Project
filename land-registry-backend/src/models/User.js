import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const User = sequelize.define('User', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  fullName: { type: DataTypes.STRING(120), allowNull: false, field: 'full_name' },
  email: { type: DataTypes.STRING(190), allowNull: false, unique: true, set(value) { this.setDataValue('email', value?.trim().toLowerCase()); } },
  phone: { type: DataTypes.STRING(20), allowNull: true, unique: true },
  walletAddress: { type: DataTypes.STRING(42), allowNull: true, unique: true, field: 'wallet_address' },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
  role: { type: DataTypes.ENUM('landowner', 'registrar', 'administrator', 'investigator', 'auditor'), allowNull: false, defaultValue: 'landowner' },
  status: { type: DataTypes.ENUM('pending', 'active', 'suspended', 'disabled'), allowNull: false, defaultValue: 'active' },
  emailVerifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'email_verified_at' },
  mfaSecretEncrypted: { type: DataTypes.TEXT, allowNull: true, field: 'mfa_secret_encrypted' },
  mfaEnabledAt: { type: DataTypes.DATE, allowNull: true, field: 'mfa_enabled_at' },
  lastLoginAt: { type: DataTypes.DATE, allowNull: true, field: 'last_login_at' },
}, { tableName: 'users', defaultScope: { attributes: { exclude: ['passwordHash'] } }, scopes: { withPassword: { attributes: { include: ['passwordHash'] } } } });

export default User;
