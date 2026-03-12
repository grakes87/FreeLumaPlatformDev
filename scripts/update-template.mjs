import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev'
});

const [rows] = await conn.query('SELECT id, html_body FROM outreach_templates WHERE is_default = 1 LIMIT 1');
let html = rows[0].html_body;

// Replace the video thumbnail+play button with a simple inline image (works for GIF autoplay)
const oldVideo = `<!-- Video thumbnail with play button -->
    <div style="text-align:center;margin:16px 0 24px;">
      <a href="{VideoUrl}" style="display:inline-block;position:relative;">
        <img src="{VideoThumbnailUrl}" alt="Watch how Free Luma works" width="100%" style="max-width:520px;border-radius:12px;border:1px solid #e5e7eb;" />
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:64px;height:64px;background:rgba(37,99,235,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;">
          <div style="width:0;height:0;border-top:12px solid transparent;border-bottom:12px solid transparent;border-left:20px solid white;margin-left:4px;"></div>
        </div>
      </a>
    </div>`;

const newVideo = `<!-- Video / GIF -->
    <div style="text-align:center;margin:16px 0 24px;">
      <img src="{VideoThumbnailUrl}" alt="See how Free Luma works" width="100%" style="max-width:520px;border-radius:12px;border:1px solid #e5e7eb;" />
    </div>`;

if (html.includes('<!-- Video thumbnail with play button -->')) {
  html = html.replace(oldVideo, newVideo);
  console.log('Video section updated to inline image (GIF-friendly)');
} else {
  console.log('Video section not found - no change');
}

await conn.query('UPDATE outreach_templates SET html_body = ? WHERE id = ?', [html, rows[0].id]);
console.log('Template saved');
await conn.end();
