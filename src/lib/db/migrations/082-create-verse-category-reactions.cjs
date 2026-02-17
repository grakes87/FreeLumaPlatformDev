'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('verse_category_reactions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      verse_category_content_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'verse_category_content', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      reaction_type: {
        type: Sequelize.ENUM('like', 'love', 'wow', 'sad', 'pray'),
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

    await queryInterface.addIndex('verse_category_reactions', ['user_id', 'verse_category_content_id'], {
      unique: true,
      name: 'verse_cat_reactions_user_content_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('verse_category_reactions');
  },
};
