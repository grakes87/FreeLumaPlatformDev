import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev'
});

// Get the template assets
const [templates] = await conn.query('SELECT id, template_assets FROM outreach_templates WHERE is_default = 1 LIMIT 1');
const assets = typeof templates[0].template_assets === 'string'
  ? JSON.parse(templates[0].template_assets)
  : templates[0].template_assets;

console.log('Template assets:', assets);

// Get all pending_review emails that still have unresolved {LogoUrl} etc.
const [emails] = await conn.query(
  "SELECT id, rendered_html, ai_html FROM outreach_emails WHERE status = 'pending_review'"
);

console.log(`Found ${emails.length} pending emails to fix`);

function applyAssets(html, assets) {
  return html.replace(/\{(\w+)\}/g, (match, field) => assets[field] ?? match);
}

let fixed = 0;
for (const email of emails) {
  const needsFix = email.rendered_html?.includes('{LogoUrl}') || 
                   email.rendered_html?.includes('{HeroImageUrl}') ||
                   email.ai_html?.includes('{LogoUrl}') || 
                   email.ai_html?.includes('{HeroImageUrl}');
  
  if (!needsFix) {
    console.log(`  Email ${email.id}: already has assets resolved, skipping`);
    continue;
  }

  const fixedRendered = applyAssets(email.rendered_html || '', assets);
  const fixedAi = applyAssets(email.ai_html || '', assets);

  await conn.query(
    'UPDATE outreach_emails SET rendered_html = ?, ai_html = ? WHERE id = ?',
    [fixedRendered, fixedAi, email.id]
  );
  console.log(`  Fixed email ${email.id}`);
  fixed++;
}

console.log(`\nDone! Fixed ${fixed} emails.`);
await conn.end();
