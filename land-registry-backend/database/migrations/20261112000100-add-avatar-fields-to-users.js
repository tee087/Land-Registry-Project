'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'avatar_key', {
      type: Sequelize.STRING(512),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'avatar_mime_type', {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'avatar_mime_type');
    await queryInterface.removeColumn('users', 'avatar_key');
  },
};
