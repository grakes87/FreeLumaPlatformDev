'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // HeyGen returns signed CloudFront URLs that exceed VARCHAR(500)
    await queryInterface.changeColumn('daily_content', 'lumashort_video_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.changeColumn('daily_content', 'creator_video_thumbnail', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('daily_content', 'lumashort_video_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.changeColumn('daily_content', 'creator_video_thumbnail', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },
};
