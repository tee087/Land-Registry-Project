'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'wallet_address', {
      type: Sequelize.STRING(42),
      allowNull: true,
      unique: true,
      after: 'phone',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'wallet_address');
  },
};
