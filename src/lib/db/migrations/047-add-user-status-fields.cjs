'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'status', {
      type: Sequelize.ENUM('active', 'deactivated', 'pending_deletion', 'banned'),
      allowNull: false,
      defaultValue: 'active',
      after: 'is_verified',
    });

    await queryInterface.addColumn('users', 'deactivated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'status',
    });

    await queryInterface.addColumn('users', 'deletion_requested_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'deactivated_at',
    });

    await queryInterface.addIndex('users', ['status'], {
      name: 'idx_users_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'idx_users_status');
    await queryInterface.removeColumn('users', 'deletion_requested_at');
    await queryInterface.removeColumn('users', 'deactivated_at');
    await queryInterface.removeColumn('users', 'status');
  },
};
