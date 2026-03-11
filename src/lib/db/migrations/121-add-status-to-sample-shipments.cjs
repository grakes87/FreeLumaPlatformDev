'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sample_shipments', 'status', {
      type: Sequelize.ENUM('pending', 'shipped', 'delivered'),
      allowNull: false,
      defaultValue: 'shipped',
      after: 'notes',
    });

    await queryInterface.addColumn('sample_shipments', 'delivered_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'status',
    });

    await queryInterface.addColumn('sample_shipments', 'follow_up_sent_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'delivered_at',
    });

    await queryInterface.addIndex('sample_shipments', ['status'], {
      name: 'idx_sample_shipments_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('sample_shipments', 'idx_sample_shipments_status');
    await queryInterface.removeColumn('sample_shipments', 'follow_up_sent_at');
    await queryInterface.removeColumn('sample_shipments', 'delivered_at');
    await queryInterface.removeColumn('sample_shipments', 'status');
  },
};
