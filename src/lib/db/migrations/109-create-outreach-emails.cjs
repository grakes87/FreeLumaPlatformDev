'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('outreach_emails', {
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
      campaign_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'outreach_campaigns', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      drip_enrollment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        // FK constraint added in migration 113 after drip_enrollments table exists
      },
      template_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'outreach_templates', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      to_email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('queued', 'sent', 'bounced', 'opened', 'clicked'),
        allowNull: false,
        defaultValue: 'queued',
      },
      tracking_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      opened_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      clicked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('outreach_emails', ['church_id'], {
      name: 'idx_outreach_emails_church',
    });
    await queryInterface.addIndex('outreach_emails', ['campaign_id'], {
      name: 'idx_outreach_emails_campaign',
    });
    await queryInterface.addIndex('outreach_emails', ['status'], {
      name: 'idx_outreach_emails_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('outreach_emails');
  },
};
