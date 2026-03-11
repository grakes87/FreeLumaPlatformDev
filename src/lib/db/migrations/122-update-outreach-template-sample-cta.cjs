'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT id, html_body FROM outreach_templates WHERE name = 'Church Outreach' AND is_default = 1 LIMIT 1`
    );

    if (!rows || rows.length === 0) return;

    const row = rows[0];
    let html = row.html_body;

    // Replace the "reply to this email" paragraph with CTA button
    const oldText = 'Would you be open to trying them out? Just reply to this email and I will get samples\n    on their way.';
    const newText = `Click below to request your free samples — just fill in your shipping info and we will
    get them on their way!
  </p>
  <div style="text-align:center;margin:30px 0;">
    <a href="https://freeluma.app/sample-request" style="display:inline-block;background:#EA580C;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
      Request Free Samples
    </a>
  </div>
  <p style="line-height:1.7;font-size:15px;margin-top:30px;">
    If you have any questions, feel free to reply to this email.`;

    if (html.includes(oldText)) {
      html = html.replace(oldText, newText);
    }

    await queryInterface.sequelize.query(
      `UPDATE outreach_templates SET html_body = ? WHERE id = ?`,
      { replacements: [html, row.id] }
    );
  },

  async down() {
    // Template can be manually edited in admin UI
  },
};
