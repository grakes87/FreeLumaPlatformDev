'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('videos', 'published_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Backfill: set published_at = created_at for already-published videos
    await queryInterface.sequelize.query(
      'UPDATE videos SET published_at = created_at WHERE published = true'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('videos', 'published_at');
  },
};
