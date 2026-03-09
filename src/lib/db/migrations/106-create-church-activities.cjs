'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('church_activities', {
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
      activity_type: {
        type: Sequelize.ENUM(
          'stage_change',
          'email_sent',
          'email_opened',
          'email_clicked',
          'note_added',
          'sample_shipped',
          'converted',
          'created',
          'scrape_completed',
          'ai_researched'
        ),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      admin_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('church_activities', ['church_id', 'created_at'], {
      name: 'idx_church_activities_church_created',
    });
    await queryInterface.addIndex('church_activities', ['activity_type'], {
      name: 'idx_church_activities_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('church_activities');
  },
};
