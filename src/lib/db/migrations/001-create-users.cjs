'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      google_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: true,
      },
      apple_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: true,
      },
      display_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING(30),
        unique: true,
        allowNull: false,
      },
      avatar_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      avatar_color: {
        type: Sequelize.STRING(7),
        allowNull: false,
      },
      bio: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      mode: {
        type: Sequelize.ENUM('bible', 'positivity'),
        defaultValue: 'bible',
        allowNull: false,
      },
      timezone: {
        type: Sequelize.STRING(50),
        defaultValue: 'America/New_York',
        allowNull: false,
      },
      preferred_translation: {
        type: Sequelize.STRING(10),
        defaultValue: 'KJV',
        allowNull: false,
      },
      language: {
        type: Sequelize.ENUM('en', 'es'),
        defaultValue: 'en',
        allowNull: false,
      },
      email_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      email_verification_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      onboarding_complete: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      is_admin: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      failed_login_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      locked_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deleted_at: {
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

    // Indexes for frequent lookups
    await queryInterface.addIndex('users', ['email'], { name: 'idx_users_email' });
    await queryInterface.addIndex('users', ['username'], { name: 'idx_users_username' });
    await queryInterface.addIndex('users', ['google_id'], { name: 'idx_users_google_id' });
    await queryInterface.addIndex('users', ['apple_id'], { name: 'idx_users_apple_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
