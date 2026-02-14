'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('daily_content_translations', 'audio_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'verse_reference',
    });

    await queryInterface.addColumn('daily_content_translations', 'audio_srt_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'audio_url',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('daily_content_translations', 'audio_srt_url');
    await queryInterface.removeColumn('daily_content_translations', 'audio_url');
  },
};
