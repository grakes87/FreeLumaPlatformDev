'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add source column
    await queryInterface.addColumn('activation_codes', 'source', {
      type: Sequelize.ENUM('generated', 'imported'),
      defaultValue: 'generated',
      allowNull: false,
      after: 'created_by',
    });

    // Add used_at column
    await queryInterface.addColumn('activation_codes', 'used_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'used_by',
    });

    // Increase code column from VARCHAR(12) to VARCHAR(16) for imported codes with dashes
    await queryInterface.changeColumn('activation_codes', 'code', {
      type: Sequelize.STRING(16),
      unique: true,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('activation_codes', 'source');
    await queryInterface.removeColumn('activation_codes', 'used_at');

    // Resize code back to VARCHAR(12)
    await queryInterface.changeColumn('activation_codes', 'code', {
      type: Sequelize.STRING(12),
      unique: true,
      allowNull: false,
    });

    // Clean up the ENUM type (MySQL)
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS \"enum_activation_codes_source\";"
    ).catch(() => {});
  },
};
