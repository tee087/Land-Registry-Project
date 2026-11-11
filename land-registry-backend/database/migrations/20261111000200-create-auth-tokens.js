'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auth_tokens', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.BIGINT, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      token_hash: { type: Sequelize.CHAR(64), allowNull: false, unique: true },
      purpose: { type: Sequelize.ENUM('email_verification', 'password_reset'), allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false }, used_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('auth_tokens', ['user_id', 'purpose']);
    await queryInterface.addIndex('auth_tokens', ['expires_at']);
  },
  async down(queryInterface) { await queryInterface.dropTable('auth_tokens'); await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_auth_tokens_purpose";'); },
};
