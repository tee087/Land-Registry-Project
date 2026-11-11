'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('blockchain_transactions', 'block_number', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });
    await queryInterface.addColumn('blockchain_transactions', 'confirmed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('blockchain_transactions', 'next_attempt_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex('blockchain_transactions', ['tx_hash']);
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('blockchain_transactions', ['tx_hash']);
    await queryInterface.removeColumn('blockchain_transactions', 'next_attempt_at');
    await queryInterface.removeColumn('blockchain_transactions', 'confirmed_at');
    await queryInterface.removeColumn('blockchain_transactions', 'block_number');
  },
};
