'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('moderation_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      admin_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'RESTRICT',
      },
      action: {
        type: Sequelize.ENUM('remove_content', 'warn_user', 'ban_user', 'unban_user', 'edit_user', 'dismiss_report'),
        allowNull: false,
      },
      target_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      target_content_type: {
        type: Sequelize.ENUM('post', 'comment', 'video'),
        allowNull: true,
      },
      target_content_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('moderation_logs', ['admin_id'], {
      name: 'idx_moderation_logs_admin_id',
    });

    await queryInterface.addIndex('moderation_logs', ['target_user_id'], {
      name: 'idx_moderation_logs_target_user_id',
    });

    await queryInterface.addIndex('moderation_logs', ['action'], {
      name: 'idx_moderation_logs_action',
    });

    await queryInterface.addIndex('moderation_logs', ['created_at'], {
      name: 'idx_moderation_logs_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('moderation_logs');
  },
};
