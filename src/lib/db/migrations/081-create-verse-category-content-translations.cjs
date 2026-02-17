'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('verse_category_content_translations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      verse_category_content_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'verse_category_content', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      translation_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      translated_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      source: {
        type: Sequelize.ENUM('database', 'api'),
        allowNull: false,
        defaultValue: 'database',
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

    await queryInterface.addIndex('verse_category_content_translations', ['verse_category_content_id', 'translation_code'], {
      unique: true,
      name: 'verse_cat_content_trans_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('verse_category_content_translations');
  },
};
