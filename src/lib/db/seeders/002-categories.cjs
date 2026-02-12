'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('categories', [
      {
        name: 'Prayer Requests',
        slug: 'prayer-requests',
        description: 'Share and support prayer requests from the community',
        icon: 'hands-praying',
        sort_order: 1,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Testimony',
        slug: 'testimony',
        description: 'Share your personal testimony and faith journey',
        icon: 'megaphone',
        sort_order: 2,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Devotional',
        slug: 'devotional',
        description: 'Daily devotionals and spiritual reflections',
        icon: 'book-open',
        sort_order: 3,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Encouragement',
        slug: 'encouragement',
        description: 'Uplifting messages and words of encouragement',
        icon: 'heart',
        sort_order: 4,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Bible Study',
        slug: 'bible-study',
        description: 'In-depth Bible study discussions and insights',
        icon: 'book-marked',
        sort_order: 5,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Worship',
        slug: 'worship',
        description: 'Worship experiences, music, and praise',
        icon: 'music',
        sort_order: 6,
        active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('categories', null, {});
  },
};
