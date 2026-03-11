'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop existing FK, make nullable, re-add FK with SET NULL
    await queryInterface.sequelize.query(
      'ALTER TABLE sample_shipments DROP FOREIGN KEY sample_shipments_ibfk_2'
    );
    await queryInterface.changeColumn('sample_shipments', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE sample_shipments ADD CONSTRAINT sample_shipments_ibfk_2 FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE'
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER TABLE sample_shipments DROP FOREIGN KEY sample_shipments_ibfk_2'
    );
    await queryInterface.changeColumn('sample_shipments', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE sample_shipments ADD CONSTRAINT sample_shipments_ibfk_2 FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE'
    );
  },
};
