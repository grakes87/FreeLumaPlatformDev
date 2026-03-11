'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE churches MODIFY COLUMN pipeline_stage ENUM('new_lead','contacted','engaged','sample_requested','sample_sent','converted','lost','unsubscribed') NOT NULL DEFAULT 'new_lead'`
    );
  },

  async down(queryInterface) {
    // Move any 'unsubscribed' churches back to 'lost' before shrinking the enum
    await queryInterface.sequelize.query(
      `UPDATE churches SET pipeline_stage = 'lost' WHERE pipeline_stage = 'unsubscribed'`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE churches MODIFY COLUMN pipeline_stage ENUM('new_lead','contacted','engaged','sample_requested','sample_sent','converted','lost') NOT NULL DEFAULT 'new_lead'`
    );
  },
};
