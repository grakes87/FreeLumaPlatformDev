'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('churches', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      google_place_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      pastor_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      staff_names: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      denomination: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      congregation_size_estimate: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      youth_programs: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      service_times: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      website_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      social_media: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      contact_email: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      contact_phone: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      address_line1: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      address_line2: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      zip_code: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'US',
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      longitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      pipeline_stage: {
        type: Sequelize.ENUM('new_lead', 'contacted', 'engaged', 'sample_requested', 'sample_sent', 'converted', 'lost'),
        allowNull: false,
        defaultValue: 'new_lead',
      },
      ai_summary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      source: {
        type: Sequelize.ENUM('google_places', 'manual', 'sample_request'),
        allowNull: false,
        defaultValue: 'manual',
      },
      notes: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('churches', ['pipeline_stage'], {
      name: 'idx_churches_pipeline_stage',
    });
    await queryInterface.addIndex('churches', ['zip_code'], {
      name: 'idx_churches_zip_code',
    });
    await queryInterface.addIndex('churches', ['state'], {
      name: 'idx_churches_state',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('churches');
  },
};
