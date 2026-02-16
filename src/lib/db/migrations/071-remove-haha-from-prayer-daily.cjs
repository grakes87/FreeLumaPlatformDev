'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Remove all haha reactions from daily content reactions
    await queryInterface.sequelize.query(
      `DELETE FROM daily_reactions WHERE reaction_type = 'haha'`
    );

    // Remove haha reactions from prayer request post_reactions only
    await queryInterface.sequelize.query(
      `DELETE pr FROM post_reactions pr
       INNER JOIN posts p ON pr.post_id = p.id
       WHERE pr.reaction_type = 'haha' AND p.post_type = 'prayer_request'`
    );
  },

  async down() {
    // Cannot restore deleted reactions — intentionally empty
  },
};
