'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('announcements', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      link_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      link_label: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      media_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      media_type: {
        type: Sequelize.ENUM('image', 'video'),
        allowNull: true,
      },
      target_mode: {
        type: Sequelize.ENUM('all', 'bible', 'positivity'),
        allowNull: false,
        defaultValue: 'all',
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      starts_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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

    await queryInterface.addIndex('announcements', ['active', 'starts_at', 'expires_at'], {
      name: 'idx_announcements_active_schedule',
    });
    await queryInterface.addIndex('announcements', ['priority'], {
      name: 'idx_announcements_priority',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('announcements');
  },
};
