'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('content_generation_logs', 'heygen_video_id', {
      type: Sequelize.STRING(64),
      allowNull: true,
      after: 'translation_code',
      comment: 'HeyGen video ID for webhook lookup (avoids race condition on shared JSON map)',
    });

    await queryInterface.addIndex('content_generation_logs', ['heygen_video_id'], {
      name: 'idx_gen_logs_heygen_video_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('content_generation_logs', 'idx_gen_logs_heygen_video_id');
    await queryInterface.removeColumn('content_generation_logs', 'heygen_video_id');
  },
};
