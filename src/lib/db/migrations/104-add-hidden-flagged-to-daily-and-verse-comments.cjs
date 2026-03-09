'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('daily_comments', 'flagged', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'edited',
    });

    await queryInterface.addColumn('daily_comments', 'hidden', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'flagged',
    });

    await queryInterface.addColumn('verse_category_comments', 'flagged', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'edited',
    });

    await queryInterface.addColumn('verse_category_comments', 'hidden', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'flagged',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('daily_comments', 'flagged');
    await queryInterface.removeColumn('daily_comments', 'hidden');
    await queryInterface.removeColumn('verse_category_comments', 'flagged');
    await queryInterface.removeColumn('verse_category_comments', 'hidden');
  },
};
