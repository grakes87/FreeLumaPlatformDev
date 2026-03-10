'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const autoDiscoveryConfig = JSON.stringify({
      enabled: false,
      target_locations: [],
      radius_miles: 25,
      min_fit_score: 6,
      max_per_run: 20,
      auto_enroll_sequence_id: null,
      run_at_hour_utc: 6,
    });

    const freelumaContext = `Free Luma is a faith-based bracelet ministry that has distributed over 600,000 bracelets worldwide. Each bracelet features a QR code that connects the wearer to the Free Luma app, delivering daily Bible verses, inspirational quotes, guided meditations, and community features. Churches partner with Free Luma by distributing bracelets to their congregation, youth groups, and community outreach events. The app supports both English and Spanish content. Church partnerships typically involve ordering sample bracelets, experiencing the daily content firsthand, and then ordering in bulk for their ministry. Free Luma bracelets serve as a tangible tool for evangelism and daily spiritual connection.`;

    await queryInterface.bulkInsert('platform_settings', [
      {
        key: 'outreach_auto_discovery_config',
        value: autoDiscoveryConfig,
        description: 'Configuration for automated church discovery (locations, radius, fit score threshold, schedule)',
        created_at: now,
        updated_at: now,
      },
      {
        key: 'outreach_freeluma_context',
        value: freelumaContext,
        description: 'Context about FreeLuma used by AI email writer to personalize outreach emails',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    const { Op } = require('sequelize');
    await queryInterface.bulkDelete('platform_settings', {
      key: { [Op.in]: ['outreach_auto_discovery_config', 'outreach_freeluma_context'] },
    });
  },
};
