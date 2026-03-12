import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev'
});

const [templates] = await conn.query('SELECT * FROM outreach_templates WHERE is_default = 1 LIMIT 1');
const template = templates[0];
const assets = typeof template.template_assets === 'string' ? JSON.parse(template.template_assets) : template.template_assets;

const [settings] = await conn.query("SELECT `value` FROM platform_settings WHERE `key` = 'outreach_freeluma_context'");
const freelumaContext = settings.length ? settings[0].value : 'Free Luma is a faith-based bracelet ministry.';

const [emails] = await conn.query(`
  SELECT e.id as email_id, c.*
  FROM outreach_emails e JOIN churches c ON c.id = e.church_id
  WHERE e.status = 'pending_review'
`);

console.log(`Regenerating ${emails.length} drafts...\n`);

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
const client = new Anthropic({ apiKey });

function renderMerge(tpl, c) {
  const map = { PastorName: c.pastor_name || 'Pastor', ChurchName: c.name, City: c.city || '', State: c.state || '', Denomination: c.denomination || 'your church', ContactName: c.pastor_name || 'Friend', ...assets };
  return tpl.replace(/\{(\w+)\}/g, (m, f) => map[f] ?? m);
}

for (const church of emails) {
  const renderedHtml = renderMerge(template.html_body, church);
  const renderedSubject = renderMerge(template.subject, church);

  let youthPrograms = 'None listed';
  if (church.youth_programs) {
    try { const p = JSON.parse(church.youth_programs); youthPrograms = Array.isArray(p) ? p.join(', ') : String(p); } catch { youthPrograms = String(church.youth_programs); }
  }

  const prompt = `Write a single short paragraph (2-4 sentences) explaining why Free Luma Bracelets would be a great fit for this specific church. This paragraph will be inserted into an existing email template — you are NOT writing the full email.

## About Free Luma
${freelumaContext}

## Church Research
- **Name:** ${church.name}
- **Pastor:** ${church.pastor_name || 'Unknown'}
- **Denomination:** ${church.denomination || 'Unknown'}
- **Size:** ${church.congregation_size_estimate || 'Unknown'}
- **Location:** ${church.city || 'Unknown'}, ${church.state || ''}
- **Youth Programs:** ${youthPrograms}
${church.ai_summary ? `- **Summary:** ${church.ai_summary}` : ''}

## Instructions
Write ONE paragraph that references specific details about this church and explains why Free Luma bracelets would complement what they are already doing. Keep it warm and genuine.

Return ONLY valid JSON:
{"subject": "${renderedSubject}", "paragraph": "Your single personalized paragraph here."}

- Keep subject as-is or make a small personalization (under 100 chars)
- The paragraph is plain text, no HTML
- 2-4 sentences max
- Return ONLY the JSON`;

  try {
    console.log(`Generating for: ${church.name}...`);
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].text.trim().replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(raw);
    if (!parsed.subject || !parsed.paragraph) throw new Error('Missing fields');

    // Insert the one paragraph before <!-- Hero image --> in the rendered template
    const pTag = `<p style="line-height:1.7;font-size:15px;">${parsed.paragraph}</p>`;
    const heroMarker = '<!-- Hero image -->';
    const heroIdx = renderedHtml.indexOf(heroMarker);

    let aiHtml;
    if (heroIdx !== -1) {
      aiHtml = renderedHtml.slice(0, heroIdx) + pTag + '\n\n    ' + renderedHtml.slice(heroIdx);
    } else {
      // Fallback: insert after second </p>
      let pos = renderedHtml.indexOf('</p>');
      if (pos !== -1) pos = renderedHtml.indexOf('</p>', pos + 4);
      if (pos !== -1) {
        const insertAt = pos + 4;
        aiHtml = renderedHtml.slice(0, insertAt) + '\n\n    ' + pTag + renderedHtml.slice(insertAt);
      } else {
        aiHtml = renderedHtml;
      }
    }

    await conn.query(
      'UPDATE outreach_emails SET subject = ?, ai_subject = ?, ai_html = ?, rendered_html = ?, tracking_id = ? WHERE id = ?',
      [parsed.subject, parsed.subject, aiHtml, renderedHtml, uuidv4(), church.email_id]
    );
    console.log(`  Subject: "${parsed.subject}"`);
    console.log(`  Tailored: "${parsed.paragraph.substring(0, 80)}..."\n`);
  } catch (err) {
    console.error(`  FAILED for ${church.name}: ${err.message}\n`);
  }
}

console.log('Done! Check the Review Queue.');
await conn.end();
