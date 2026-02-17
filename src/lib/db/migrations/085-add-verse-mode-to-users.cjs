'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'verse_mode', {
      type: Sequelize.ENUM('daily_verse', 'verse_by_category'),
      defaultValue: 'daily_verse',
      allowNull: false,
      after: 'preferred_translation',
    });

    await queryInterface.addColumn('users', 'verse_category_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: { model: 'verse_categories', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      after: 'verse_mode',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'verse_category_id');
    await queryInterface.removeColumn('users', 'verse_mode');
  },
};
