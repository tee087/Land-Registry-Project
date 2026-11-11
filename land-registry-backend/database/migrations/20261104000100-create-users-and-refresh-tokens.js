'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      full_name: { type: Sequelize.STRING(120), allowNull: false },
      email: { type: Sequelize.STRING(190), allowNull: false, unique: true },
      phone: { type: Sequelize.STRING(20), allowNull: true, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role: { type: Sequelize.ENUM('landowner','registrar','administrator','investigator','auditor'), allowNull: false, defaultValue: 'landowner' },
      status: { type: Sequelize.ENUM('pending','active','suspended','disabled'), allowNull: false, defaultValue: 'active' },
      email_verified_at: { type: Sequelize.DATE, allowNull: true },
      last_login_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.createTable('refresh_tokens', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      token_hash: { type: Sequelize.CHAR(64), allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('refresh_tokens', ['user_id']);
    await queryInterface.addIndex('refresh_tokens', ['expires_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('refresh_tokens');
    await queryInterface.dropTable('users');
  },
};
