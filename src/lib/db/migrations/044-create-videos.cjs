'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('videos', {
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
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'video_categories',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      video_url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      thumbnail_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      caption_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      duration_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      view_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_hero: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      published: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
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

    await queryInterface.addIndex('videos', ['category_id'], {
      name: 'idx_videos_category_id',
    });
    await queryInterface.addIndex('videos', ['uploaded_by'], {
      name: 'idx_videos_uploaded_by',
    });
    await queryInterface.addIndex('videos', ['published'], {
      name: 'idx_videos_published',
    });
    await queryInterface.addIndex('videos', ['is_hero'], {
      name: 'idx_videos_is_hero',
    });
    await queryInterface.addIndex('videos', ['view_count'], {
      name: 'idx_videos_view_count',
    });
    // Composite index for category browsing (published videos by category sorted by popularity)
    await queryInterface.addIndex('videos', ['published', 'category_id', 'view_count'], {
      name: 'idx_videos_published_category_views',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('videos');
  },
};
