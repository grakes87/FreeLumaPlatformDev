'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Extend the email_type ENUM to include all 12 values
    await queryInterface.sequelize.query(`
      ALTER TABLE email_logs
      MODIFY COLUMN email_type ENUM(
        'dm_batch',
        'follow_request',
        'prayer_response',
        'daily_reminder',
        'reaction_comment_batch',
        'workshop_reminder',
        'workshop_cancelled',
        'workshop_invite',
        'workshop_recording',
        'workshop_updated',
        'workshop_started',
        'new_video'
      ) NOT NULL
    `);
  },

  async down(queryInterface) {
    // Revert to original 4 values.
    // NOTE: Any rows with new email_type values must be deleted first,
    // otherwise this migration will fail. In practice, you should run:
    //   DELETE FROM email_logs WHERE email_type NOT IN ('dm_batch','follow_request','prayer_response','daily_reminder');
    // before rolling back this migration.
    await queryInterface.sequelize.query(`
      ALTER TABLE email_logs
      MODIFY COLUMN email_type ENUM(
        'dm_batch',
        'follow_request',
        'prayer_response',
        'daily_reminder'
      ) NOT NULL
    `);
  },
};
