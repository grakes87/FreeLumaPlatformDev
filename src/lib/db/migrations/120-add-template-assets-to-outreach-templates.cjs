'use strict';

// Step HTML blocks to replace with image placeholders
const STEP1_HTML = `<div style="background:#f0f7ff;border-radius:12px;padding:20px 12px;">
            <div style="font-size:28px;margin-bottom:8px;">1</div>
            <p style="font-size:13px;color:#333;margin:0;font-weight:600;">Wear the bracelet</p>
            <p style="font-size:12px;color:#666;margin:4px 0 0;">A daily reminder of faith</p>
          </div>`;

const STEP2_HTML = `<div style="background:#f0f7ff;border-radius:12px;padding:20px 12px;">
            <div style="font-size:28px;margin-bottom:8px;">2</div>
            <p style="font-size:13px;color:#333;margin:0;font-weight:600;">Scan the QR code</p>
            <p style="font-size:12px;color:#666;margin:4px 0 0;">Opens the Free Luma app</p>
          </div>`;

const STEP3_HTML = `<div style="background:#f0f7ff;border-radius:12px;padding:20px 12px;">
            <div style="font-size:28px;margin-bottom:8px;">3</div>
            <p style="font-size:13px;color:#333;margin:0;font-weight:600;">Daily inspiration</p>
            <p style="font-size:12px;color:#666;margin:4px 0 0;">Bible verses, devotionals &amp; more</p>
          </div>`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add template_assets JSON column
    await queryInterface.addColumn('outreach_templates', 'template_assets', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });

    // 2. Replace hardcoded image URLs with placeholders
    const logoUrl = 'https://f005.backblazeb2.com/file/FreeLumaPlatform/avatars/2/1770967778639-v0v6eb.jpg';
    const heroUrl = 'https://freeluma.app/images/bracelet-hero.jpg';
    const videoThumbUrl = 'https://freeluma.app/images/video-thumbnail.jpg';

    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET html_body = REPLACE(
         REPLACE(
           REPLACE(html_body, :logoUrl, '{LogoUrl}'),
           :heroUrl, '{HeroImageUrl}'
         ),
         :videoThumbUrl, '{VideoThumbnailUrl}'
       )
       WHERE id = 1`,
      { replacements: { logoUrl, heroUrl, videoThumbUrl } }
    );

    // 3. Replace video link URL with placeholder
    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET html_body = REPLACE(html_body, 'https://freeluma.app/watch', '{VideoUrl}')
       WHERE id = 1`
    );

    // 4. Replace 3-step HTML cards with image placeholders
    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET html_body = REPLACE(html_body, :step1, :step1img)
       WHERE id = 1`,
      {
        replacements: {
          step1: STEP1_HTML,
          step1img: '<img src="{Step1ImageUrl}" alt="Step 1: Wear the bracelet" width="100%" style="border-radius:12px;" />',
        },
      }
    );
    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET html_body = REPLACE(html_body, :step2, :step2img)
       WHERE id = 1`,
      {
        replacements: {
          step2: STEP2_HTML,
          step2img: '<img src="{Step2ImageUrl}" alt="Step 2: Scan the QR code" width="100%" style="border-radius:12px;" />',
        },
      }
    );
    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET html_body = REPLACE(html_body, :step3, :step3img)
       WHERE id = 1`,
      {
        replacements: {
          step3: STEP3_HTML,
          step3img: '<img src="{Step3ImageUrl}" alt="Step 3: Daily inspiration" width="100%" style="border-radius:12px;" />',
        },
      }
    );

    // 5. Seed template_assets with original URLs (steps empty — need upload)
    //    Use JSON_OBJECT() so MariaDB/MySQL stores a proper JSON object, not a string.
    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET template_assets = JSON_OBJECT(
         'LogoUrl', :logoUrl2,
         'HeroImageUrl', :heroUrl2,
         'VideoUrl', 'https://freeluma.app/watch',
         'VideoThumbnailUrl', :videoThumbUrl2
       )
       WHERE id = 1`,
      {
        replacements: {
          logoUrl2: logoUrl,
          heroUrl2: heroUrl,
          videoThumbUrl2: videoThumbUrl,
        },
      }
    );
  },

  async down(queryInterface) {
    const logoUrl = 'https://f005.backblazeb2.com/file/FreeLumaPlatform/avatars/2/1770967778639-v0v6eb.jpg';
    const heroUrl = 'https://freeluma.app/images/bracelet-hero.jpg';
    const videoThumbUrl = 'https://freeluma.app/images/video-thumbnail.jpg';

    // Restore image URLs
    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET html_body = REPLACE(
         REPLACE(
           REPLACE(html_body, '{LogoUrl}', :logoUrl),
           '{HeroImageUrl}', :heroUrl
         ),
         '{VideoThumbnailUrl}', :videoThumbUrl
       )
       WHERE id = 1`,
      { replacements: { logoUrl, heroUrl, videoThumbUrl } }
    );

    // Restore video link
    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET html_body = REPLACE(html_body, '{VideoUrl}', 'https://freeluma.app/watch')
       WHERE id = 1`
    );

    // Restore step HTML cards
    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET html_body = REPLACE(html_body,
         '<img src="{Step1ImageUrl}" alt="Step 1: Wear the bracelet" width="100%" style="border-radius:12px;" />',
         :step1)
       WHERE id = 1`,
      { replacements: { step1: STEP1_HTML } }
    );
    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET html_body = REPLACE(html_body,
         '<img src="{Step2ImageUrl}" alt="Step 2: Scan the QR code" width="100%" style="border-radius:12px;" />',
         :step2)
       WHERE id = 1`,
      { replacements: { step2: STEP2_HTML } }
    );
    await queryInterface.sequelize.query(
      `UPDATE outreach_templates
       SET html_body = REPLACE(html_body,
         '<img src="{Step3ImageUrl}" alt="Step 3: Daily inspiration" width="100%" style="border-radius:12px;" />',
         :step3)
       WHERE id = 1`,
      { replacements: { step3: STEP3_HTML } }
    );

    await queryInterface.removeColumn('outreach_templates', 'template_assets');
  },
};
