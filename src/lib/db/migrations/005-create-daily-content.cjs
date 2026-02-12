'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('daily_content', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      post_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      mode: {
        type: Sequelize.ENUM('bible', 'positivity'),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      content_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      verse_reference: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      chapter_reference: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      video_background_url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      audio_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      audio_srt_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      lumashort_video_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      language: {
        type: Sequelize.ENUM('en', 'es'),
        defaultValue: 'en',
        allowNull: false,
      },
      published: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
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

    await queryInterface.addIndex('daily_content', ['post_date'], { name: 'idx_daily_content_post_date' });
    await queryInterface.addIndex('daily_content', ['post_date', 'mode', 'language'], {
      unique: true,
      name: 'unique_post_date_mode_language',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('daily_content');
  },
};
