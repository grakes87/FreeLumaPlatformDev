'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bible_translations', 'api_bible_id', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      after: 'name',
    });

    // Populate with known API.Bible IDs
    const mappings = [
      ['KJV',  'de4e12af7f28f599-02'],
      ['NIV',  '78a9f6124f344018-01'],
      ['NKJV', '63097d2a0a2f7db3-01'],
      ['NLT',  'd6e14a625393b4da-01'],
      ['CSB',  'a556c5305ee15c3f-01'],
      ['NIRV', '5b888a42e2d9a89d-01'],
      ['AMP',  'a81b73293d3080c9-01'],
      ['NVI',  '01c25b8715dbb632-01'],
      ['RVR',  '592420522e16049f-01'],
    ];

    for (const [code, apiId] of mappings) {
      await queryInterface.sequelize.query(
        'UPDATE bible_translations SET api_bible_id = ? WHERE code = ?',
        { replacements: [apiId, code] }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bible_translations', 'api_bible_id');
  },
};
