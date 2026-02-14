'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('daily_content_translations', 'lumashort_video_url');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('daily_content_translations', 'lumashort_video_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'audio_srt_url',
    });
  },
};
