'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE users MODIFY COLUMN mode ENUM('bible', 'positivity', 'both') NOT NULL DEFAULT 'bible'"
    );
  },

  async down(queryInterface) {
    // Convert any 'both' users back to 'bible' before shrinking the enum
    await queryInterface.sequelize.query(
      "UPDATE users SET mode = 'bible' WHERE mode = 'both'"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE users MODIFY COLUMN mode ENUM('bible', 'positivity') NOT NULL DEFAULT 'bible'"
    );
  },
};
