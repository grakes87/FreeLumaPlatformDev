'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('daily_reactions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
      reaction_type: {
        type: Sequelize.ENUM('like', 'love', 'haha', 'wow', 'sad', 'pray'),
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

    await queryInterface.addIndex('daily_reactions', ['user_id', 'daily_content_id'], {
      unique: true,
      name: 'daily_reactions_user_content_unique',
    });

    await queryInterface.addIndex('daily_reactions', ['daily_content_id', 'reaction_type'], {
      name: 'daily_reactions_content_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('daily_reactions');
  },
};
