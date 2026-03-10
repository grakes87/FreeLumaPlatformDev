'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('churches', 'outreach_fit_score', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn('churches', 'outreach_fit_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('churches', 'has_youth_ministry', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('churches', 'has_young_adult_ministry', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('churches', 'has_small_groups', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('churches', 'has_missions_focus', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('churches', 'has_missions_focus');
    await queryInterface.removeColumn('churches', 'has_small_groups');
    await queryInterface.removeColumn('churches', 'has_young_adult_ministry');
    await queryInterface.removeColumn('churches', 'has_youth_ministry');
    await queryInterface.removeColumn('churches', 'outreach_fit_reason');
    await queryInterface.removeColumn('churches', 'outreach_fit_score');
  },
};
