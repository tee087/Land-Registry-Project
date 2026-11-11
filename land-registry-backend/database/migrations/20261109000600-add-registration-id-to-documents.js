'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('documents', 'registration_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'registrations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      after: 'parcel_id',
    });
    await queryInterface.addIndex('documents', ['registration_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('documents', ['registration_id']);
    await queryInterface.removeColumn('documents', 'registration_id');
  },
};
