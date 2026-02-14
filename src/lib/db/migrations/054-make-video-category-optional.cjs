'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE videos MODIFY category_id INTEGER NULL'
    );
  },

  async down(queryInterface) {
    // Set any NULLs to the first active category before re-adding NOT NULL
    const [categories] = await queryInterface.sequelize.query(
      "SELECT id FROM video_categories WHERE is_active = true ORDER BY sort_order ASC LIMIT 1"
    );
    if (categories.length > 0) {
      await queryInterface.sequelize.query(
        `UPDATE videos SET category_id = ${categories[0].id} WHERE category_id IS NULL`
      );
    }
    await queryInterface.sequelize.query(
      'ALTER TABLE videos MODIFY category_id INTEGER NOT NULL'
    );
  },
};
