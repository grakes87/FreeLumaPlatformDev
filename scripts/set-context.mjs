import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev'
});

const context = `Free Luma was founded by Gary Rakes, a software engineer from Missouri who saw how social media's emotional volatility was impacting mental health — especially among young people. After navigating his own journey through isolation and depression, Gary wanted to create something different: a digital safe space where people could consistently find inspiration, faith, and genuine community.

Free Luma Bracelets are NFC-enabled wristbands that connect to the Free Luma app with a simple tap. Each day, wearers receive a fresh Bible verse, a short devotional, a 2-3 minute guided meditation, and Luma Shorts — casual, FaceTime-style video messages that feel like a pep talk from a best friend. The platform also features an interactive prayer wall, community posts, and virtual Bible study tools.

Key facts:
- 600,000+ bracelets in circulation worldwide
- 83% of users report increased daily Bible reading within 30 days
- Available in English and Spanish
- AI-moderated community with activation codes for safety
- A portion of every purchase is donated to World Vision, the Jed Foundation, and the American Foundation for Suicide Prevention
- Expanding to retail locations in Spokane, WA

Churches use Free Luma bracelets for youth groups, small groups, outreach events, VBS, retreats, and everyday evangelism. They are a simple, tangible way to keep congregation members connected to God's Word throughout the week — not just on Sundays. We provide free sample packs so church leaders can experience them firsthand before ordering for their community.

Gary's vision: "Social media is a rollercoaster of emotions. I wanted to create a space where people could consistently find inspiration." Free Luma is not just a product — it is a ministry tool born from personal experience and a genuine desire to help people encounter God daily.`;

await conn.query(
  'INSERT INTO platform_settings (`key`, `value`, `description`, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = NOW()',
  ['outreach_freeluma_context', context, 'Rich backstory about Free Luma used by AI email writer for church outreach personalization']
);
console.log('Platform setting saved');
await conn.end();
