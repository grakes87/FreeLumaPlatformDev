import { MERGE_FIELDS } from './template-renderer';

interface DefaultTemplate {
  name: string;
  subject: string;
  html_body: string;
  merge_fields: string[];
  template_assets: Record<string, string>;
}

const mergeFields = [...MERGE_FIELDS];

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Church Outreach',
    subject: 'Free Luma Bracelets for {ChurchName}',
    html_body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <p style="line-height:1.7;font-size:15px;">Dear {PastorName},</p>
  <p style="line-height:1.7;font-size:15px;">
    I hope this message finds you well. I am reaching out from Free Luma Bracelets because
    I believe what we are doing could be a real blessing to {ChurchName} and your community
    in {City}.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    <strong>Free Luma Bracelets</strong> are wearable faith tools — each bracelet features a
    QR code that connects the wearer to our app, delivering a fresh Bible verse, devotional
    content, and guided meditations every single day. We have distributed over 600,000 bracelets
    to churches and ministries worldwide.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    Churches use them for youth groups, small groups, outreach events, VBS, retreats, and
    everyday evangelism. They are a simple, tangible way to keep people connected to God's
    Word throughout the week — not just on Sundays.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    I would love to send a <strong>free sample pack</strong> to {ChurchName} so you and your
    team can experience them firsthand. No cost, no obligation — we just want to serve your
    ministry.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    Click below to request your free samples — just fill in your shipping info and we will
    get them on their way!
  </p>
  <div style="text-align:center;margin:30px 0;">
    <a href="{SampleRequestUrl}" style="display:inline-block;background:#EA580C;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
      Request Free Samples
    </a>
  </div>
  <p style="line-height:1.7;font-size:15px;margin-top:30px;">
    Blessings,<br/>
    <strong>The Free Luma Bracelets Team</strong>
  </p>
</div>`,
    merge_fields: mergeFields,
    template_assets: {
      LogoUrl: 'https://f005.backblazeb2.com/file/FreeLumaPlatform/avatars/2/1770967778639-v0v6eb.jpg',
      HeroImageUrl: 'https://freeluma.app/images/bracelet-hero.jpg',
      VideoUrl: 'https://freeluma.app/watch',
      VideoThumbnailUrl: 'https://freeluma.app/images/video-thumbnail.jpg',
    },
  },
];

/**
 * Seed default templates if none exist (idempotent).
 * Called lazily on first GET /api/admin/church-outreach/templates.
 */
export async function seedDefaultTemplates(): Promise<void> {
  const { OutreachTemplate } = await import('@/lib/db/models');

  const count = await OutreachTemplate.count();
  if (count > 0) return;

  await OutreachTemplate.bulkCreate(
    DEFAULT_TEMPLATES.map((t) => ({
      name: t.name,
      subject: t.subject,
      html_body: t.html_body,
      merge_fields: t.merge_fields,
      template_assets: t.template_assets,
      is_default: true,
    }))
  );
}
