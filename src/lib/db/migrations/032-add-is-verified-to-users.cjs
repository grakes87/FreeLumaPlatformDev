'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'is_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'is_admin',
    });

    // Mark the admin user as verified
    await queryInterface.sequelize.query(
      "UPDATE users SET is_verified = true WHERE email = 'admin@freeluma.com'"
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'is_verified');
  },
};
