'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('videos', 'min_age', {
      type: Sequelize.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      after: 'is_hero',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('videos', 'min_age');
  },
};
