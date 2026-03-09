'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('drip_enrollments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      church_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'churches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sequence_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'drip_sequences', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      current_step: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM('active', 'paused', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'active',
      },
      next_step_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      enrolled_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('drip_enrollments', ['church_id', 'sequence_id'], {
      name: 'idx_drip_enrollments_church_sequence',
    });
    await queryInterface.addIndex('drip_enrollments', ['status', 'next_step_at'], {
      name: 'idx_drip_enrollments_status_next',
    });

    // Add FK constraint on outreach_emails.drip_enrollment_id now that drip_enrollments exists
    await queryInterface.addConstraint('outreach_emails', {
      fields: ['drip_enrollment_id'],
      type: 'foreign key',
      name: 'fk_outreach_emails_drip_enrollment',
      references: {
        table: 'drip_enrollments',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('outreach_emails', 'fk_outreach_emails_drip_enrollment');
    await queryInterface.dropTable('drip_enrollments');
  },
};
