'use strict';

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

    // 4. Seed template_assets with original URLs
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

    await queryInterface.removeColumn('outreach_templates', 'template_assets');
  },
};
