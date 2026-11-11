'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('documents', ['storage_key'], {
      name: 'documents_storage_key_unique',
      unique: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('documents', 'documents_storage_key_unique');
  },
};
