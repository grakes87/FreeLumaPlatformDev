'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_settings', 'messaging_access', {
      type: Sequelize.ENUM('everyone', 'followers', 'mutual', 'nobody'),
      allowNull: false,
      defaultValue: 'mutual',
      after: 'quiet_hours_end',
    });

    await queryInterface.addColumn('user_settings', 'email_dm_notifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'messaging_access',
    });

    await queryInterface.addColumn('user_settings', 'email_follow_notifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'email_dm_notifications',
    });

    await queryInterface.addColumn('user_settings', 'email_prayer_notifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'email_follow_notifications',
    });

    await queryInterface.addColumn('user_settings', 'email_daily_reminder', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'email_prayer_notifications',
    });

    await queryInterface.addColumn('user_settings', 'reminder_timezone', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      after: 'email_daily_reminder',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('user_settings', 'reminder_timezone');
    await queryInterface.removeColumn('user_settings', 'email_daily_reminder');
    await queryInterface.removeColumn('user_settings', 'email_prayer_notifications');
    await queryInterface.removeColumn('user_settings', 'email_follow_notifications');
    await queryInterface.removeColumn('user_settings', 'email_dm_notifications');
    await queryInterface.removeColumn('user_settings', 'messaging_access');
  },
};
