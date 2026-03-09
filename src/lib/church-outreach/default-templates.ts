import { MERGE_FIELDS } from './template-renderer';

interface DefaultTemplate {
  name: string;
  subject: string;
  html_body: string;
  merge_fields: string[];
}

const mergeFields = [...MERGE_FIELDS];

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Introduction',
    subject: 'Bless Your Youth Group with Free Luma Bracelets',
    html_body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h2 style="color:#2563eb;margin-bottom:20px;">Bless Your Youth Group with Free Luma Bracelets</h2>
  <p style="line-height:1.7;font-size:15px;">Dear {PastorName},</p>
  <p style="line-height:1.7;font-size:15px;">
    I hope this message finds you well. My name is Luma, and I am reaching out to share something
    that has been making a real difference in youth groups across the country.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    <strong>Free Luma Bracelets</strong> are wearable faith tools designed specifically for young people.
    Each bracelet connects to our app via NFC or QR code, delivering a fresh Bible verse and devotional
    content every single day. It is a simple, tangible way to keep God's Word in front of your youth
    throughout their week -- not just on Sundays.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    We have seen youth groups at churches like {ChurchName} use these bracelets to spark conversations
    about faith, build daily scripture habits, and create a sense of community among their teens.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    I would love to send a <strong>free sample pack</strong> to {ChurchName} so you and your team can
    see how they work firsthand. There is no cost and no obligation -- we simply want to serve your ministry.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    Would you be open to trying them out? Just reply to this email and I will get a sample pack on its way.
  </p>
  <p style="line-height:1.7;font-size:15px;margin-top:30px;">
    Blessings,<br/>
    <strong>The Free Luma Bracelets Team</strong>
  </p>
</div>`,
    merge_fields: mergeFields,
  },

  {
    name: 'Follow-Up',
    subject: 'Following Up on Free Luma Bracelets for {ChurchName}',
    html_body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h2 style="color:#2563eb;margin-bottom:20px;">Following Up on Free Luma Bracelets</h2>
  <p style="line-height:1.7;font-size:15px;">Dear {PastorName},</p>
  <p style="line-height:1.7;font-size:15px;">
    I wanted to follow up on my earlier message about Free Luma Bracelets. I know how busy ministry
    life can be, so I wanted to make sure this did not slip through the cracks.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    As a quick reminder, Free Luma Bracelets are wearable faith tools that connect young people to daily
    scripture through a simple tap on their phone. Each day, your youth receive a new Bible verse,
    a short devotional, and encouraging content designed to strengthen their walk with God.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    Here is what makes them special for youth ministry:
  </p>
  <ul style="line-height:1.7;font-size:15px;padding-left:20px;">
    <li>Daily engagement with scripture outside of church</li>
    <li>A physical reminder of faith they actually want to wear</li>
    <li>Built-in community features where youth can share and encourage each other</li>
    <li>Works with both NFC and QR -- compatible with any smartphone</li>
  </ul>
  <p style="line-height:1.7;font-size:15px;">
    I would love to send a <strong>free sample pack</strong> to {ChurchName} in {City} with absolutely
    no strings attached. If your youth love them, great -- we can talk about getting more. If not, no worries at all.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    Would you like me to send a few samples your way?
  </p>
  <p style="line-height:1.7;font-size:15px;margin-top:30px;">
    Blessings,<br/>
    <strong>The Free Luma Bracelets Team</strong>
  </p>
</div>`,
    merge_fields: mergeFields,
  },

  {
    name: 'Sample Offer',
    subject: 'Free Sample Bracelets for {ChurchName}',
    html_body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h2 style="color:#2563eb;margin-bottom:20px;">Free Sample Bracelets for {ChurchName}</h2>
  <p style="line-height:1.7;font-size:15px;">Dear {PastorName},</p>
  <p style="line-height:1.7;font-size:15px;">
    I am writing to offer <strong>free sample Free Luma Bracelets</strong> for your youth ministry
    at {ChurchName}. We believe in what these bracelets can do for young believers, and we want you
    to experience it firsthand.
  </p>
  <p style="line-height:1.7;font-size:15px;font-weight:bold;">
    Here is how they work:
  </p>
  <ol style="line-height:1.7;font-size:15px;padding-left:20px;">
    <li>Each youth receives a bracelet</li>
    <li>They tap it with their phone (NFC) or scan the QR code</li>
    <li>The Free Luma app opens with that day's Bible verse and devotional</li>
    <li>A new verse appears every day, building a daily scripture habit</li>
  </ol>
  <p style="line-height:1.7;font-size:15px;">
    We would like to send a pack of <strong>5 sample bracelets</strong> to {ChurchName} at no cost.
    All we need is a shipping address.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    Could you reply with the best address to send them to? We will have them on their way within a few days.
  </p>
  <p style="line-height:1.7;font-size:15px;margin-top:30px;">
    In His service,<br/>
    <strong>The Free Luma Bracelets Team</strong>
  </p>
</div>`,
    merge_fields: mergeFields,
  },

  {
    name: 'Post-Sample Check-In',
    subject: 'How Are Your Youth Enjoying Their Free Luma Bracelets?',
    html_body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h2 style="color:#2563eb;margin-bottom:20px;">How Are the Bracelets Working Out?</h2>
  <p style="line-height:1.7;font-size:15px;">Dear {PastorName},</p>
  <p style="line-height:1.7;font-size:15px;">
    I wanted to check in and see how the Free Luma Bracelets are going with your youth group
    at {ChurchName}. I hope the young people have been enjoying their daily verses!
  </p>
  <p style="line-height:1.7;font-size:15px;">
    We would love to hear about their experience:
  </p>
  <ul style="line-height:1.7;font-size:15px;padding-left:20px;">
    <li>Are the youth wearing them regularly?</li>
    <li>Have they been checking their daily verses?</li>
    <li>Has it sparked any conversations about scripture?</li>
    <li>Any feedback from parents or youth leaders?</li>
  </ul>
  <p style="line-height:1.7;font-size:15px;">
    If the bracelets have been a hit, we would love to help you get enough for your entire youth group.
    We offer special ministry pricing that makes it affordable for churches of any size. Many churches
    find that bracelets make wonderful gifts for retreats, confirmation, VBS, or just because.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    Just reply to this email and I can put together a custom quote based on your group's size.
    No pressure at all -- we are here to serve {ChurchName} however we can.
  </p>
  <p style="line-height:1.7;font-size:15px;margin-top:30px;">
    Blessings,<br/>
    <strong>The Free Luma Bracelets Team</strong>
  </p>
</div>`,
    merge_fields: mergeFields,
  },

  {
    name: 'Testimonial Share',
    subject: 'Churches Are Seeing Amazing Results with Free Luma',
    html_body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h2 style="color:#2563eb;margin-bottom:20px;">Churches Are Seeing Amazing Results</h2>
  <p style="line-height:1.7;font-size:15px;">Dear {PastorName},</p>
  <p style="line-height:1.7;font-size:15px;">
    I wanted to share some encouraging news from churches that have been using Free Luma Bracelets
    with their youth groups.
  </p>
  <div style="background:#f0f7ff;border-left:4px solid #2563eb;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
    <p style="line-height:1.7;font-size:15px;font-style:italic;margin:0;">
      "Our youth group went from barely engaging with scripture to kids actually excited about their
      daily verse. The bracelets gave them a reason to open their Bible app every day. We have seen
      real spiritual growth in just a few months."
    </p>
    <p style="line-height:1.7;font-size:14px;color:#666;margin:10px 0 0;">
      -- Youth Pastor, Community Church
    </p>
  </div>
  <p style="line-height:1.7;font-size:15px;">
    Stories like this are exactly why we do what we do. Young people are hungry for faith, and
    sometimes they just need the right tool to help them build that daily connection with God's Word.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    I think {ChurchName} in {City}, {State} could see the same kind of impact. If you are interested,
    I would love to send you a free sample pack so you can try them out with your youth.
  </p>
  <p style="line-height:1.7;font-size:15px;">
    Would you like to learn more or receive some samples?
  </p>
  <p style="line-height:1.7;font-size:15px;margin-top:30px;">
    In His service,<br/>
    <strong>The Free Luma Bracelets Team</strong>
  </p>
</div>`,
    merge_fields: mergeFields,
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
      is_default: true,
    }))
  );
}
