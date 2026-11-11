import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id' },
  type: { type: DataTypes.STRING(60), allowNull: false },
  category: { type: DataTypes.STRING(60), allowNull: true, field: 'category' },
  title: { type: DataTypes.STRING(160), allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: true },
  readAt: { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
}, { tableName: 'notifications', underscored: true, timestamps: true });

export default Notification;
