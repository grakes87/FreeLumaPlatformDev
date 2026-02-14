'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('activity_streaks', {
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
        onDelete: 'CASCADE',
      },
      activity_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      activities: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('activity_streaks', ['user_id', 'activity_date'], {
      name: 'idx_activity_streaks_user_date',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('activity_streaks');
  },
};
