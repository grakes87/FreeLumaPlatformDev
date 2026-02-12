'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('prayer_requests', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      post_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'posts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      privacy: {
        type: Sequelize.ENUM('public', 'followers', 'private'),
        allowNull: false,
        defaultValue: 'public',
      },
      status: {
        type: Sequelize.ENUM('active', 'answered'),
        allowNull: false,
        defaultValue: 'active',
      },
      answered_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      answered_testimony: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      pray_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('prayer_requests', ['status'], {
      name: 'prayer_requests_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('prayer_requests');
  },
};
