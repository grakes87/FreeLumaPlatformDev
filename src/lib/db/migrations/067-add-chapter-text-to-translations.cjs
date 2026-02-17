'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('daily_content_translations', 'chapter_text', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      after: 'translated_text',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('daily_content_translations', 'chapter_text');
  },
};
