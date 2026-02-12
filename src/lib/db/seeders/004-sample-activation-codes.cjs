'use strict';

function generateCode(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const codes = [];
    const usedCodes = new Set();

    for (let i = 0; i < 10; i++) {
      let code;
      do {
        code = generateCode(12);
      } while (usedCodes.has(code));
      usedCodes.add(code);

      codes.push({
        code,
        used: false,
        used_by: null,
        mode_hint: i < 5 ? 'bible' : 'positivity',
        expires_at: oneYearFromNow,
        created_by: null,
        created_at: now,
        updated_at: now,
      });
    }

    await queryInterface.bulkInsert('activation_codes', codes);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('activation_codes', null, {});
  },
};
