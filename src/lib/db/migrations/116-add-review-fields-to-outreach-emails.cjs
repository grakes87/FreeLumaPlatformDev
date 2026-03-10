'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Alter status ENUM to include pending_review and rejected
    await queryInterface.sequelize.query(`
      ALTER TABLE outreach_emails
      MODIFY COLUMN status ENUM('queued','sent','bounced','opened','clicked','pending_review','rejected')
      NOT NULL DEFAULT 'queued'
    `);

    // 2. Add review + AI columns
    await queryInterface.addColumn('outreach_emails', 'reviewed_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('outreach_emails', 'reviewed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('outreach_emails', 'ai_html', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
    });

    await queryInterface.addColumn('outreach_emails', 'rendered_html', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
    });

    await queryInterface.addColumn('outreach_emails', 'ai_subject', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    await queryInterface.addColumn('outreach_emails', 'rejection_reason', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    // 3. Add composite index for review queue queries
    await queryInterface.addIndex('outreach_emails', ['status', 'created_at'], {
      name: 'idx_outreach_emails_status_created',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('outreach_emails', 'idx_outreach_emails_status_created');
    await queryInterface.removeColumn('outreach_emails', 'rejection_reason');
    await queryInterface.removeColumn('outreach_emails', 'ai_subject');
    await queryInterface.removeColumn('outreach_emails', 'rendered_html');
    await queryInterface.removeColumn('outreach_emails', 'ai_html');
    await queryInterface.removeColumn('outreach_emails', 'reviewed_at');
    await queryInterface.removeColumn('outreach_emails', 'reviewed_by');

    await queryInterface.sequelize.query(`
      ALTER TABLE outreach_emails
      MODIFY COLUMN status ENUM('queued','sent','bounced','opened','clicked')
      NOT NULL DEFAULT 'queued'
    `);
  },
};
