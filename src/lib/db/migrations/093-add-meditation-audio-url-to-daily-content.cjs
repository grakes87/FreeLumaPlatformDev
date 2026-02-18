'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('daily_content', 'meditation_audio_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'meditation_script',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('daily_content', 'meditation_audio_url');
  },
};
