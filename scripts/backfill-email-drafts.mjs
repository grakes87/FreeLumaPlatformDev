import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev'
});

// Get default template
const [templates] = await conn.query('SELECT * FROM outreach_templates WHERE is_default = 1 ORDER BY id ASC LIMIT 1');
if (templates.length === 0) {
  console.error('No default template found.');
  process.exit(1);
}
const template = templates[0];

// Get churches with email that don't already have an outreach email
const [churches] = await conn.query(
  "SELECT * FROM churches WHERE contact_email IS NOT NULL AND contact_email != '' AND id NOT IN (SELECT church_id FROM outreach_emails)"
);
console.log(`Found ${churches.length} churches needing email drafts`);

function render(tpl, c) {
  const map = {
    PastorName: c.pastor_name || 'Pastor',
    ChurchName: c.name,
    City: c.city || '',
    State: c.state || '',
    Denomination: c.denomination || 'your church',
    ContactName: c.pastor_name || 'Friend',
  };
  return tpl.replace(/\{(\w+)\}/g, (m, f) => map[f] ?? m);
}

for (const church of churches) {
  const renderedHtml = render(template.html_body, church);
  const renderedSubject = render(template.subject, church);
  const trackingId = uuidv4();

  await conn.query(
    `INSERT INTO outreach_emails
      (church_id, template_id, to_email, subject, status, tracking_id, rendered_html, ai_html, ai_subject, created_at)
     VALUES (?, ?, ?, ?, 'pending_review', ?, ?, ?, ?, NOW())`,
    [church.id, template.id, church.contact_email, renderedSubject, trackingId, renderedHtml, renderedHtml, renderedSubject]
  );
  console.log(`  Created draft for: ${church.name} <${church.contact_email}>`);
}

const [result] = await conn.query("SELECT COUNT(*) as c FROM outreach_emails WHERE status = 'pending_review'");
console.log(`\nDone! ${result[0].c} emails now in review queue.`);

await conn.end();
