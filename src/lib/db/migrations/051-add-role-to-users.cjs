'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.ENUM('user', 'moderator', 'admin'),
      allowNull: false,
      defaultValue: 'user',
      after: 'is_verified',
    });

    await queryInterface.addIndex('users', ['role'], {
      name: 'idx_users_role',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'idx_users_role');
    await queryInterface.removeColumn('users', 'role');
  },
};
