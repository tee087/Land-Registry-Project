'use strict';

const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false },
  updated_at: { type: Sequelize.DATE, allowNull: false },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('forensic_findings', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      evidence_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'evidence', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      parcel_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'land_parcels', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      case_id: { type: Sequelize.STRING(80), allowNull: false },
      title: { type: Sequelize.STRING(160), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      finding: { type: Sequelize.TEXT, allowNull: false },
      risk_level: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium',
      },
      status: { type: Sequelize.ENUM('open', 'closed'), allowNull: false, defaultValue: 'open' },
      recorded_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
      },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('forensic_findings', ['evidence_id']);
    await queryInterface.addIndex('forensic_findings', ['case_id']);
    await queryInterface.addIndex('forensic_findings', ['recorded_by']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('forensic_findings');
  },
};
