'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('daily_content', 'status', {
      type: Sequelize.ENUM('empty', 'generated', 'assigned', 'submitted', 'rejected', 'approved'),
      allowNull: false,
      defaultValue: 'empty',
      after: 'published',
    });

    await queryInterface.addColumn('daily_content', 'creator_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'luma_short_creators',
        key: 'id',
      },
      onDelete: 'SET NULL',
      after: 'status',
    });

    await queryInterface.addColumn('daily_content', 'camera_script', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'creator_id',
    });

    await queryInterface.addColumn('daily_content', 'devotional_reflection', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'camera_script',
    });

    await queryInterface.addColumn('daily_content', 'meditation_script', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'devotional_reflection',
    });

    await queryInterface.addColumn('daily_content', 'background_prompt', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'meditation_script',
    });

    await queryInterface.addColumn('daily_content', 'rejection_note', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'background_prompt',
    });

    await queryInterface.addColumn('daily_content', 'creator_video_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'rejection_note',
    });

    await queryInterface.addColumn('daily_content', 'creator_video_thumbnail', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'creator_video_url',
    });

    await queryInterface.addIndex('daily_content', ['status', 'mode', 'post_date'], {
      name: 'idx_status_mode_date',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('daily_content', 'idx_status_mode_date');
    await queryInterface.removeColumn('daily_content', 'creator_video_thumbnail');
    await queryInterface.removeColumn('daily_content', 'creator_video_url');
    await queryInterface.removeColumn('daily_content', 'rejection_note');
    await queryInterface.removeColumn('daily_content', 'background_prompt');
    await queryInterface.removeColumn('daily_content', 'meditation_script');
    await queryInterface.removeColumn('daily_content', 'devotional_reflection');
    await queryInterface.removeColumn('daily_content', 'camera_script');
    await queryInterface.removeColumn('daily_content', 'creator_id');
    await queryInterface.removeColumn('daily_content', 'status');
  },
};
