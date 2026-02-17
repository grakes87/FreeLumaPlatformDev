'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('workshop_bans', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      host_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      banned_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      banned_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      workshop_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'workshops', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Workshop where the ban originated',
      },
      reason: {
        type: Sequelize.STRING(500),
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // One ban per host-user pair (lifetime ban from this host's workshops)
    await queryInterface.addIndex('workshop_bans', ['host_id', 'banned_user_id'], {
      unique: true,
      name: 'workshop_bans_host_user_unique',
    });

    // Fast lookup: is this user banned by any host?
    await queryInterface.addIndex('workshop_bans', ['banned_user_id', 'host_id'], {
      name: 'workshop_bans_banned_user_host',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workshop_bans');
  },
};
