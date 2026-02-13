'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      recipient_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('follow', 'follow_request', 'reaction', 'comment', 'prayer', 'message', 'mention', 'group_invite', 'daily_reminder'),
        allowNull: false,
      },
      entity_type: {
        type: Sequelize.ENUM('post', 'comment', 'follow', 'prayer_request', 'message', 'conversation', 'daily_content'),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      preview_text: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      group_key: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    // Index for fetching user's unread notifications sorted by date
    await queryInterface.addIndex('notifications', ['recipient_id', 'is_read', 'created_at'], {
      name: 'idx_notif_recipient_read',
    });

    // Index for notification grouping/collapsing
    await queryInterface.addIndex('notifications', ['group_key', 'recipient_id'], {
      name: 'idx_notif_group_key',
    });

    // Index for 30-day cleanup job
    await queryInterface.addIndex('notifications', ['created_at'], {
      name: 'idx_notif_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  },
};
