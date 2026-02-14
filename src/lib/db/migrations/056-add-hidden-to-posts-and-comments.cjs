'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('posts', 'hidden', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'flagged',
    });

    await queryInterface.addColumn('post_comments', 'hidden', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'flagged',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('posts', 'hidden');
    await queryInterface.removeColumn('post_comments', 'hidden');
  },
};
