'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('content_generation_logs', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      daily_content_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'daily_content', key: 'id' },
        onDelete: 'CASCADE',
      },
      field: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Field being generated: camera_script, background_prompt, tts, srt, chapter_text, etc.',
      },
      translation_code: {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: 'Translation code if field is translation-level (e.g., AMP, KJV)',
      },
      status: {
        type: Sequelize.ENUM('started', 'success', 'failed'),
        allowNull: false,
        defaultValue: 'started',
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      duration_ms: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'How long the generation took in milliseconds',
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

    await queryInterface.addIndex('content_generation_logs', ['daily_content_id']);
    await queryInterface.addIndex('content_generation_logs', ['status']);
    await queryInterface.addIndex('content_generation_logs', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('content_generation_logs');
  },
};
