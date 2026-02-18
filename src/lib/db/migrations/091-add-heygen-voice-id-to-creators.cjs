'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('luma_short_creators', 'heygen_voice_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
      after: 'heygen_avatar_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('luma_short_creators', 'heygen_voice_id');
  },
};
