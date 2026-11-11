'use strict';

const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false },
  updated_at: { type: Sequelize.DATE, allowNull: false },
});

const userRef = (Sequelize, { nullable = false, onDelete = 'SET NULL' } = {}) => ({
  type: Sequelize.BIGINT.UNSIGNED,
  allowNull: nullable,
  references: { model: 'users', key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('land_parcels', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      parcel_number: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      county: { type: Sequelize.STRING(80), allowNull: false },
      block: { type: Sequelize.STRING(80), allowNull: true },
      location: { type: Sequelize.STRING(160), allowNull: true },
      area_hectares: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      status: {
        type: Sequelize.ENUM('active', 'frozen', 'disputed', 'archived'),
        allowNull: false,
        defaultValue: 'active',
      },
      registered_by: userRef(Sequelize, { nullable: true }),
      ...timestamps(Sequelize),
    });

    await queryInterface.createTable('ownerships', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      parcel_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: false,
        references: { model: 'land_parcels', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      owner_id: userRef(Sequelize, { onDelete: 'CASCADE' }),
      share_percent: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 100 },
      is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      acquired_at: { type: Sequelize.DATE, allowNull: true },
      ended_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('ownerships', ['parcel_id']);
    await queryInterface.addIndex('ownerships', ['owner_id']);
    await queryInterface.addIndex('ownerships', ['is_current']);

    await queryInterface.createTable('registrations', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      parcel_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: false,
        references: { model: 'land_parcels', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      applicant_id: userRef(Sequelize, { onDelete: 'CASCADE' }),
      status: {
        type: Sequelize.ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'submitted',
      },
      reviewed_by: userRef(Sequelize, { nullable: true }),
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      decision_notes: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('registrations', ['parcel_id']);
    await queryInterface.addIndex('registrations', ['applicant_id']);
    await queryInterface.addIndex('registrations', ['status']);

    await queryInterface.createTable('transfers', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      parcel_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: false,
        references: { model: 'land_parcels', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      from_owner_id: userRef(Sequelize, { onDelete: 'CASCADE' }),
      to_owner_id: userRef(Sequelize, { onDelete: 'CASCADE' }),
      initiated_by: userRef(Sequelize, { onDelete: 'CASCADE' }),
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      reviewed_by: userRef(Sequelize, { nullable: true }),
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('transfers', ['parcel_id']);
    await queryInterface.addIndex('transfers', ['status']);

    await queryInterface.createTable('documents', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      parcel_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: true,
        references: { model: 'land_parcels', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      uploaded_by: userRef(Sequelize, { nullable: true }),
      original_name: { type: Sequelize.STRING(255), allowNull: false },
      storage_key: { type: Sequelize.STRING(255), allowNull: false },
      mime_type: { type: Sequelize.STRING(120), allowNull: false },
      size_bytes: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
      sha256: { type: Sequelize.CHAR(64), allowNull: false },
      version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      is_current: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('documents', ['parcel_id']);
    await queryInterface.addIndex('documents', ['sha256']);

    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      actor_id: userRef(Sequelize, { nullable: true }),
      action: { type: Sequelize.STRING(80), allowNull: false },
      entity_type: { type: Sequelize.STRING(60), allowNull: false },
      entity_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
      request_id: { type: Sequelize.STRING(64), allowNull: true },
      ip: { type: Sequelize.STRING(64), allowNull: true },
      metadata: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['actor_id']);
    await queryInterface.addIndex('audit_logs', ['created_at']);

    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      user_id: userRef(Sequelize, { onDelete: 'CASCADE' }),
      type: { type: Sequelize.STRING(60), allowNull: false },
      title: { type: Sequelize.STRING(160), allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: true },
      read_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('notifications', ['user_id', 'read_at']);

    await queryInterface.createTable('evidence', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      parcel_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: true,
        references: { model: 'land_parcels', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      custody_ref: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT, allowNull: false },
      collected_by: userRef(Sequelize, { nullable: true }),
      status: {
        type: Sequelize.ENUM('collected', 'in_custody', 'analyzed', 'released'),
        allowNull: false,
        defaultValue: 'collected',
      },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('evidence', ['parcel_id']);

    await queryInterface.createTable('evidence_custody', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      evidence_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: false,
        references: { model: 'evidence', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      actor_id: userRef(Sequelize, { nullable: true }),
      action: { type: Sequelize.STRING(60), allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('evidence_custody', ['evidence_id']);

    await queryInterface.createTable('blockchain_transactions', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      entity_type: { type: Sequelize.STRING(60), allowNull: false },
      entity_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
      action: { type: Sequelize.STRING(60), allowNull: false },
      status: {
        type: Sequelize.ENUM('pending', 'submitted', 'confirmed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      tx_hash: { type: Sequelize.STRING(66), allowNull: true },
      attempts: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      last_error: { type: Sequelize.TEXT, allowNull: true },
      payload: { type: Sequelize.JSON, allowNull: true },
      ...timestamps(Sequelize),
    });
    await queryInterface.addIndex('blockchain_transactions', ['status']);
    await queryInterface.addIndex('blockchain_transactions', ['entity_type', 'entity_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('blockchain_transactions');
    await queryInterface.dropTable('evidence_custody');
    await queryInterface.dropTable('evidence');
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('documents');
    await queryInterface.dropTable('transfers');
    await queryInterface.dropTable('registrations');
    await queryInterface.dropTable('ownerships');
    await queryInterface.dropTable('land_parcels');
  },
};
