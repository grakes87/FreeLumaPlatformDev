'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'phone_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'phone',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'phone_verified');
  },
};
