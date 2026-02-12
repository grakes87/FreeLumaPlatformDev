'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('posts', {
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
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      post_type: {
        type: Sequelize.ENUM('text', 'prayer_request'),
        allowNull: false,
        defaultValue: 'text',
      },
      visibility: {
        type: Sequelize.ENUM('public', 'followers'),
        allowNull: false,
        defaultValue: 'public',
      },
      mode: {
        type: Sequelize.ENUM('bible', 'positivity'),
        allowNull: false,
      },
      edited: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_anonymous: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      flagged: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deleted_at: {
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

    await queryInterface.addIndex('posts', ['user_id'], {
      name: 'posts_user_id',
    });

    await queryInterface.addIndex('posts', ['post_type'], {
      name: 'posts_post_type',
    });

    await queryInterface.addIndex('posts', ['mode'], {
      name: 'posts_mode',
    });

    await queryInterface.addIndex('posts', ['created_at', 'id'], {
      name: 'posts_created_at_id_desc',
    });

    await queryInterface.addIndex('posts', ['user_id', 'created_at'], {
      name: 'posts_user_created',
    });

    await queryInterface.addIndex('posts', ['flagged'], {
      name: 'posts_flagged',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('posts');
  },
};
