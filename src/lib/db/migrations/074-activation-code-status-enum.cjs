'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Step 1: Add new 'status' column with the 3 statuses
    await queryInterface.sequelize.query(`
      ALTER TABLE activation_codes
      ADD COLUMN status ENUM('pending', 'generated', 'activated') NOT NULL DEFAULT 'generated'
      AFTER source
    `);

    // Step 2: Migrate data from source + used to status
    // imported codes -> pending
    await queryInterface.sequelize.query(`
      UPDATE activation_codes SET status = 'pending' WHERE source = 'imported'
    `);
    // generated + used -> activated
    await queryInterface.sequelize.query(`
      UPDATE activation_codes SET status = 'activated' WHERE source = 'generated' AND used = 1
    `);
    // generated + not used -> generated (already the default)

    // Step 3: Drop the old source column
    await queryInterface.sequelize.query(`
      ALTER TABLE activation_codes DROP COLUMN source
    `);
  },

  async down(queryInterface) {
    // Re-add source column
    await queryInterface.sequelize.query(`
      ALTER TABLE activation_codes
      ADD COLUMN source ENUM('generated', 'imported') NOT NULL DEFAULT 'generated'
      AFTER created_by
    `);

    // Migrate back
    await queryInterface.sequelize.query(`
      UPDATE activation_codes SET source = 'imported' WHERE status = 'pending'
    `);
    await queryInterface.sequelize.query(`
      UPDATE activation_codes SET source = 'generated' WHERE status IN ('generated', 'activated')
    `);

    // Drop status column
    await queryInterface.sequelize.query(`
      ALTER TABLE activation_codes DROP COLUMN status
    `);
  },
};
