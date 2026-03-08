'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `moderation_logs` MODIFY COLUMN `action` ENUM('remove_content', 'warn_user', 'ban_user', 'unban_user', 'edit_user', 'dismiss_report', 'send_reset_email') NOT NULL"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `moderation_logs` MODIFY COLUMN `action` ENUM('remove_content', 'warn_user', 'ban_user', 'unban_user', 'edit_user', 'dismiss_report') NOT NULL"
    );
  },
};
