'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('announcement_dismissals', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      announcement_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'announcements', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('announcement_dismissals', {
      fields: ['user_id', 'announcement_id'],
      type: 'unique',
      name: 'uq_announcement_dismissals_user_announcement',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('announcement_dismissals');
  },
};
