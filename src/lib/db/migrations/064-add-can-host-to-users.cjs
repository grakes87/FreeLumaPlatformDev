'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'can_host', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'role',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'can_host');
  },
};
