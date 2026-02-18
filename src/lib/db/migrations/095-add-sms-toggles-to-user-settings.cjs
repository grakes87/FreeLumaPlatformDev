'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_settings', 'sms_notifications_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'email_new_video_notifications',
    });
    await queryInterface.addColumn('user_settings', 'sms_dm_notifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'sms_notifications_enabled',
    });
    await queryInterface.addColumn('user_settings', 'sms_follow_notifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'sms_dm_notifications',
    });
    await queryInterface.addColumn('user_settings', 'sms_prayer_notifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'sms_follow_notifications',
    });
    await queryInterface.addColumn('user_settings', 'sms_daily_reminder', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'sms_prayer_notifications',
    });
    await queryInterface.addColumn('user_settings', 'sms_workshop_notifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'sms_daily_reminder',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('user_settings', 'sms_workshop_notifications');
    await queryInterface.removeColumn('user_settings', 'sms_daily_reminder');
    await queryInterface.removeColumn('user_settings', 'sms_prayer_notifications');
    await queryInterface.removeColumn('user_settings', 'sms_follow_notifications');
    await queryInterface.removeColumn('user_settings', 'sms_dm_notifications');
    await queryInterface.removeColumn('user_settings', 'sms_notifications_enabled');
  },
};
