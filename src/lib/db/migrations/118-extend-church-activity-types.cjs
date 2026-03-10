'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE church_activities
      MODIFY COLUMN activity_type ENUM(
        'stage_change','email_sent','email_opened','email_clicked',
        'note_added','sample_shipped','converted','created',
        'scrape_completed','ai_researched',
        'auto_discovered','auto_imported','email_approved','email_rejected'
      ) NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE church_activities
      MODIFY COLUMN activity_type ENUM(
        'stage_change','email_sent','email_opened','email_clicked',
        'note_added','sample_shipped','converted','created',
        'scrape_completed','ai_researched'
      ) NOT NULL
    `);
  },
};
