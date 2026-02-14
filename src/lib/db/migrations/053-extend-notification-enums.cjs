'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Extend notifications type ENUM — must list ALL existing values plus new ones
    await queryInterface.sequelize.query(
      "ALTER TABLE `notifications` MODIFY COLUMN `type` ENUM('follow', 'follow_request', 'reaction', 'comment', 'prayer', 'message', 'mention', 'group_invite', 'daily_reminder', 'new_video', 'content_removed', 'warning', 'ban') NOT NULL"
    );

    // Extend notifications entity_type ENUM — must list ALL existing values plus new ones
    await queryInterface.sequelize.query(
      "ALTER TABLE `notifications` MODIFY COLUMN `entity_type` ENUM('post', 'comment', 'follow', 'prayer_request', 'message', 'conversation', 'daily_content', 'video') NOT NULL"
    );
  },

  async down(queryInterface) {
    // Revert to original ENUM values
    await queryInterface.sequelize.query(
      "ALTER TABLE `notifications` MODIFY COLUMN `type` ENUM('follow', 'follow_request', 'reaction', 'comment', 'prayer', 'message', 'mention', 'group_invite', 'daily_reminder') NOT NULL"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `notifications` MODIFY COLUMN `entity_type` ENUM('post', 'comment', 'follow', 'prayer_request', 'message', 'conversation', 'daily_content') NOT NULL"
    );
  },
};
