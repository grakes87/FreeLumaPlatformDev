'use strict';

const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const passwordHash = await bcrypt.hash('AdminDev123!', 12);

    await queryInterface.bulkInsert('users', [
      {
        email: 'admin@freeluma.com',
        password_hash: passwordHash,
        google_id: null,
        apple_id: null,
        display_name: 'Admin',
        username: 'admin',
        avatar_url: null,
        avatar_color: '#6366F1',
        bio: 'Free Luma Platform Administrator',
        date_of_birth: null,
        mode: 'bible',
        timezone: 'America/New_York',
        preferred_translation: 'KJV',
        language: 'en',
        email_verified: true,
        email_verification_token: null,
        onboarding_complete: true,
        is_admin: true,
        last_login_at: null,
        failed_login_attempts: 0,
        locked_until: null,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    // Create default settings for admin user
    const [users] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = 'admin@freeluma.com' LIMIT 1"
    );
    if (users.length > 0) {
      await queryInterface.bulkInsert('user_settings', [
        {
          user_id: users[0].id,
          dark_mode: 'system',
          push_enabled: true,
          email_notifications: true,
          daily_reminder_time: '08:00',
          quiet_hours_start: null,
          quiet_hours_end: null,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },

  async down(queryInterface) {
    // Remove admin's settings first (FK constraint)
    const [users] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = 'admin@freeluma.com' LIMIT 1"
    );
    if (users.length > 0) {
      await queryInterface.bulkDelete('user_settings', { user_id: users[0].id });
    }
    await queryInterface.bulkDelete('users', { email: 'admin@freeluma.com' });
  },
};
