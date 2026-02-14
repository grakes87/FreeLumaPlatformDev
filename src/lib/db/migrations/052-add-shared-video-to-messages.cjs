'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages', 'shared_video_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'videos',
        key: 'id',
      },
      onDelete: 'SET NULL',
      after: 'shared_post_id',
    });

    // ALTER messages type ENUM to include 'shared_video' — must list ALL existing values plus new one
    await queryInterface.sequelize.query(
      "ALTER TABLE `messages` MODIFY COLUMN `type` ENUM('text', 'media', 'voice', 'shared_post', 'shared_video', 'system') NOT NULL DEFAULT 'text'"
    );
  },

  async down(queryInterface) {
    // Revert ENUM change first (remove shared_video)
    await queryInterface.sequelize.query(
      "ALTER TABLE `messages` MODIFY COLUMN `type` ENUM('text', 'media', 'voice', 'shared_post', 'system') NOT NULL DEFAULT 'text'"
    );

    await queryInterface.removeColumn('messages', 'shared_video_id');
  },
};
