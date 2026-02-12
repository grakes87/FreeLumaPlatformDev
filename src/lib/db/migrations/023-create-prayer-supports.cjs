'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('prayer_supports', {
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
      prayer_request_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'prayer_requests',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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

    await queryInterface.addIndex('prayer_supports', ['user_id', 'prayer_request_id'], {
      unique: true,
      name: 'prayer_supports_user_request_unique',
    });

    await queryInterface.addIndex('prayer_supports', ['prayer_request_id'], {
      name: 'prayer_supports_request',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('prayer_supports');
  },
};
