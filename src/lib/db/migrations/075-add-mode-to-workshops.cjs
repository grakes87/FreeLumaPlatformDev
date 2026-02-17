'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('workshops', 'mode', {
      type: Sequelize.ENUM('bible', 'positivity'),
      allowNull: false,
      defaultValue: 'bible',
      after: 'is_private',
    });

    await queryInterface.addColumn('workshop_series', 'mode', {
      type: Sequelize.ENUM('bible', 'positivity'),
      allowNull: false,
      defaultValue: 'bible',
      after: 'is_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('workshops', 'mode');
    await queryInterface.removeColumn('workshop_series', 'mode');
  },
};
