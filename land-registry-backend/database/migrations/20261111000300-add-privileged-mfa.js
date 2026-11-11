'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'mfa_secret_encrypted', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('users', 'mfa_enabled_at', { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'mfa_enabled_at');
    await queryInterface.removeColumn('users', 'mfa_secret_encrypted');
  },
};
