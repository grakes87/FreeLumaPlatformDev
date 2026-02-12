'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'denomination', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'bio',
    });

    await queryInterface.addColumn('users', 'church', {
      type: Sequelize.STRING(200),
      allowNull: true,
      after: 'denomination',
    });

    await queryInterface.addColumn('users', 'testimony', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'church',
    });

    await queryInterface.addColumn('users', 'profile_privacy', {
      type: Sequelize.ENUM('public', 'private'),
      allowNull: false,
      defaultValue: 'public',
      after: 'testimony',
    });

    await queryInterface.addColumn('users', 'location', {
      type: Sequelize.STRING(200),
      allowNull: true,
      after: 'profile_privacy',
    });

    await queryInterface.addColumn('users', 'website', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'location',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'website');
    await queryInterface.removeColumn('users', 'location');
    await queryInterface.removeColumn('users', 'profile_privacy');
    await queryInterface.removeColumn('users', 'testimony');
    await queryInterface.removeColumn('users', 'church');
    await queryInterface.removeColumn('users', 'denomination');
  },
};
