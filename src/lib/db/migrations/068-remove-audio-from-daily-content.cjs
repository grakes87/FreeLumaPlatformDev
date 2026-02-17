'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('daily_content', 'audio_url');
    await queryInterface.removeColumn('daily_content', 'audio_srt_url');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('daily_content', 'audio_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn('daily_content', 'audio_srt_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },
};
