'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('luma_short_creators', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'RESTRICT',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      link_1: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      link_2: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      link_3: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      languages: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: '["en"]',
      },
      monthly_capacity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 15,
      },
      can_bible: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      can_positivity: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_ai: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      heygen_avatar_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
      },
      updated_at: {
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('luma_short_creators', ['active', 'can_bible', 'can_positivity'], {
      name: 'idx_active_mode',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('luma_short_creators');
  },
};
