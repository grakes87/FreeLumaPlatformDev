'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_logs', {
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
      email_type: {
        type: Sequelize.ENUM('dm_batch', 'follow_request', 'prayer_response', 'daily_reminder'),
        allowNull: false,
      },
      subject: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('queued', 'sent', 'bounced', 'opened'),
        allowNull: false,
        defaultValue: 'queued',
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      opened_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      tracking_id: {
        type: Sequelize.STRING(100),
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

    // Index for processing queued emails and status queries
    await queryInterface.addIndex('email_logs', ['status', 'created_at'], {
      name: 'idx_email_log_status',
    });

    // Index for tracking pixel lookups
    await queryInterface.addIndex('email_logs', ['tracking_id'], {
      name: 'idx_email_log_tracking',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_logs');
  },
};
