'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('video_reactions', {
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
      video_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'videos',
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

    // One reaction per user per video
    await queryInterface.addIndex('video_reactions', ['user_id', 'video_id'], {
      unique: true,
      name: 'unique_user_video_reaction',
    });
    // For count queries by video
    await queryInterface.addIndex('video_reactions', ['video_id'], {
      name: 'idx_video_reactions_video_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('video_reactions');
  },
};
