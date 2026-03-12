import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, user: 'root',
  password: 'Luma!2026#R9vK3pT7xQ2mZ5sN8cH1yW4',
  database: 'freeluma_dev'
});

const context = `Free Luma was founded by Gary Rakes, a software engineer from Missouri who saw how social media's emotional volatility was impacting mental health — especially among young people. Gary wanted to create something different: a way for people to stay connected to God's Word every single day — not through another social media feed, but through a simple, tangible reminder they can wear.

Free Luma Bracelets are NFC-enabled wristbands. With a quick tap on your phone, you receive a daily Bible verse, a short devotional, a guided meditation, and Luma Shorts — brief encouraging video messages. The Free Luma app also features an interactive prayer wall where believers can post requests and celebrate answered prayers, community Bible studies, and a supportive community of Christian believers.

Our mission is to empower individuals to embrace positivity, faith, and personal growth — Live Bright, Live Free. Each bracelet design is anchored in scripture — from Psalm 46:10 "Be still and know that I am God" to Luke 19:10 "For the Son of Man came to seek and to save the lost."

Key facts:
- 600,000+ bracelets in circulation worldwide
- 83% of users report increased daily Bible reading within 30 days
- Available in English and Spanish
- AI-moderated community with activation codes for safety
- A portion of every purchase is donated to World Vision, the Jed Foundation, and the American Foundation for Suicide Prevention

Churches use Free Luma bracelets for youth groups, small groups, outreach events, VBS, retreats, and everyday evangelism — a tangible way to keep people connected to God's Word throughout the week, not just on Sundays. We provide free sample packs so church leaders can experience them firsthand.`;

await conn.query(
  'UPDATE platform_settings SET `value` = ?, updated_at = NOW() WHERE `key` = ?',
  [context, 'outreach_freeluma_context']
);
console.log('Context updated');
await conn.end();
