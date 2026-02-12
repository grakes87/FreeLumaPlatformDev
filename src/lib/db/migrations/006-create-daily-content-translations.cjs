'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('daily_content_translations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      daily_content_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'daily_content',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      translation_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      translated_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      verse_reference: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      source: {
        type: Sequelize.ENUM('database', 'api'),
        defaultValue: 'database',
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

    await queryInterface.addIndex('daily_content_translations', ['daily_content_id', 'translation_code'], {
      unique: true,
      name: 'unique_content_translation',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('daily_content_translations');
  },
};
