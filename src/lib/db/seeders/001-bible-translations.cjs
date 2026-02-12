'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('bible_translations', [
      {
        code: 'KJV',
        name: 'King James Version',
        language: 'en',
        is_public_domain: true,
        attribution_text: null,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        code: 'NIV',
        name: 'New International Version',
        language: 'en',
        is_public_domain: false,
        attribution_text:
          'Scripture quotations taken from The Holy Bible, New International Version\u00AE NIV\u00AE. Copyright \u00A9 1973, 1978, 1984, 2011 by Biblica, Inc.\u2122 Used by permission. All rights reserved worldwide.',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        code: 'NRSV',
        name: 'New Revised Standard Version',
        language: 'en',
        is_public_domain: false,
        attribution_text:
          'New Revised Standard Version Bible, copyright \u00A9 1989 the Division of Christian Education of the National Council of the Churches of Christ in the United States of America. Used by permission. All rights reserved.',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        code: 'NAB',
        name: 'New American Bible',
        language: 'en',
        is_public_domain: false,
        attribution_text:
          'Scripture texts in this work are taken from the New American Bible, revised edition \u00A9 2010, 1991, 1986, 1970 Confraternity of Christian Doctrine, Washington, D.C. and are used by permission of the copyright owner. All rights reserved.',
        active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('bible_translations', null, {});
  },
};
