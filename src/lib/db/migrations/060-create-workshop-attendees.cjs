'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('workshop_attendees', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      workshop_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'workshops',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('rsvp', 'joined', 'left'),
        allowNull: false,
        defaultValue: 'rsvp',
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      left_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_co_host: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      can_speak: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.addConstraint('workshop_attendees', {
      fields: ['workshop_id', 'user_id'],
      type: 'unique',
      name: 'workshop_attendees_workshop_user_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workshop_attendees');
  },
};
