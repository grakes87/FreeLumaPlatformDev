'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('platform_settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(500),
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

    // Seed default platform settings
    await queryInterface.bulkInsert('platform_settings', [
      {
        key: 'feed_style',
        value: 'tiktok',
        description: 'Feed display style: tiktok or instagram',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        key: 'mode_isolation_social',
        value: 'true',
        description: 'Isolate social feed by user mode',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        key: 'mode_isolation_prayer',
        value: 'true',
        description: 'Isolate prayer wall by user mode',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        key: 'registration_mode',
        value: 'invite',
        description: 'Registration mode: open or invite',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        key: 'maintenance_mode',
        value: 'false',
        description: 'Enable maintenance mode',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        key: 'profanity_filter_enabled',
        value: 'true',
        description: 'Enable profanity filter on content',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        key: 'ai_moderation_enabled',
        value: 'false',
        description: 'Enable AI content moderation',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('platform_settings');
  },
};
