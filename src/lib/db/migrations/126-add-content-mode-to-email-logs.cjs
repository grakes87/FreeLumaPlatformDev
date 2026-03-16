'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add content_mode column (nullable ENUM, only used for daily_reminder emails)
    await queryInterface.addColumn('email_logs', 'content_mode', {
      type: Sequelize.ENUM('bible', 'positivity'),
      allowNull: true,
      defaultValue: null,
      after: 'email_type',
    });

    // 2. Add composite index for efficient dedup lookups
    await queryInterface.addIndex('email_logs', ['recipient_id', 'email_type', 'created_at'], {
      name: 'idx_email_log_recipient_type_date',
    });
  },

  async down(queryInterface) {
    // Remove the index first, then the column
    await queryInterface.removeIndex('email_logs', 'idx_email_log_recipient_type_date');
    await queryInterface.removeColumn('email_logs', 'content_mode');
  },
};
