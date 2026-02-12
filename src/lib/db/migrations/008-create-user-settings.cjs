'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        unique: true,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      dark_mode: {
        type: Sequelize.ENUM('light', 'dark', 'system'),
        defaultValue: 'system',
        allowNull: false,
      },
      push_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      email_notifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      daily_reminder_time: {
        type: Sequelize.STRING(5),
        defaultValue: '08:00',
        allowNull: false,
      },
      quiet_hours_start: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
      quiet_hours_end: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_settings');
  },
};
