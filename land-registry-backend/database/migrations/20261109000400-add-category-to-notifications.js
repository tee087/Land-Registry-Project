'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('notifications', 'category', {
      type: Sequelize.STRING(60),
      allowNull: true,
      after: 'type',
    });
    await queryInterface.addIndex('notifications', ['category']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('notifications', ['category']);
    await queryInterface.removeColumn('notifications', 'category');
  },
};
