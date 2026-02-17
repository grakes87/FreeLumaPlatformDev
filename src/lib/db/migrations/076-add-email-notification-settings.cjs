'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_settings', 'email_reaction_comment_notifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('user_settings', 'email_workshop_notifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('user_settings', 'email_new_video_notifications', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('user_settings', 'email_reaction_comment_notifications');
    await queryInterface.removeColumn('user_settings', 'email_workshop_notifications');
    await queryInterface.removeColumn('user_settings', 'email_new_video_notifications');
  },
};
