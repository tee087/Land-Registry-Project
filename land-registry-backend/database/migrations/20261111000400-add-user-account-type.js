'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'account_type', {
      type: Sequelize.STRING(24),
      allowNull: false,
      defaultValue: 'buyer_seller',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'account_type');
  },
};
