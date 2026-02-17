'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('used_bible_verses', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      book: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      chapter: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      verse: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      verse_reference: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      used_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      daily_content_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'daily_content',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('used_bible_verses', ['book', 'chapter', 'verse'], {
      unique: true,
      name: 'unique_verse_usage',
    });

    await queryInterface.addIndex('used_bible_verses', ['used_date'], {
      name: 'idx_used_date',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('used_bible_verses');
  },
};
