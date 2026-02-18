'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sms_logs', {
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
      sms_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      body: {
        type: Sequelize.STRING(320),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('queued', 'sent', 'delivered', 'failed'),
        allowNull: false,
        defaultValue: 'queued',
      },
      twilio_sid: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      delivered_at: {
        type: Sequelize.DATE,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('sms_logs', ['recipient_id'], {
      name: 'idx_sms_logs_recipient',
    });
    await queryInterface.addIndex('sms_logs', ['status'], {
      name: 'idx_sms_logs_status',
    });
    await queryInterface.addIndex('sms_logs', ['sms_type'], {
      name: 'idx_sms_logs_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sms_logs');
  },
};
