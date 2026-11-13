'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('account_mode_requests', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
      reference: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      user_id: { type: Sequelize.BIGINT, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      current_account_type: { type: Sequelize.STRING(24), allowNull: false },
      requested_account_type: { type: Sequelize.STRING(24), allowNull: false },
      token_hash: { type: Sequelize.CHAR(64), allowNull: false, unique: true },
      status: { type: Sequelize.ENUM('pending', 'approved', 'cancelled', 'expired'), allowNull: false, defaultValue: 'pending' },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('account_mode_requests', ['user_id', 'status'], { name: 'account_mode_requests_user_status_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('account_mode_requests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_account_mode_requests_status";');
  },
};
