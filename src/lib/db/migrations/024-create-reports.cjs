'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reports', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      reporter_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      post_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'posts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      comment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      content_type: {
        type: Sequelize.ENUM('post', 'comment'),
        allowNull: false,
      },
      reason: {
        type: Sequelize.ENUM('spam', 'harassment', 'hate_speech', 'inappropriate', 'self_harm', 'other'),
        allowNull: false,
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'reviewed', 'actioned', 'dismissed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      admin_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reviewed_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('reports', ['status'], {
      name: 'reports_status',
    });

    await queryInterface.addIndex('reports', ['reporter_id'], {
      name: 'reports_reporter',
    });

    await queryInterface.addIndex('reports', ['post_id'], {
      name: 'reports_post',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reports');
  },
};
