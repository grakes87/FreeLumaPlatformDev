'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('workshops', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      series_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'workshop_series',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      host_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'workshop_categories',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      duration_minutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      actual_started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      actual_ended_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'lobby', 'live', 'ended', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled',
      },
      is_private: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      max_capacity: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      recording_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      recording_sid: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      recording_resource_id: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      agora_channel: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      attendee_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('workshops', ['host_id']);
    await queryInterface.addIndex('workshops', ['category_id']);
    await queryInterface.addIndex('workshops', ['status', 'scheduled_at']);
    await queryInterface.addIndex('workshops', ['series_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workshops');
  },
};
