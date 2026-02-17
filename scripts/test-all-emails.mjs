/**
 * Test script: sends one of each email template type to a test address.
 * Usage: node scripts/test-all-emails.mjs
 */
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually (dotenv/config only reads .env)
import { config } from 'dotenv';
config({ path: join(__dirname, '..', '.env.local') });

const TEST_EMAIL = 'garywork05@gmail.com';

// Dynamic import so env vars are loaded first
const sgMail = (await import('@sendgrid/mail')).default;

if (!process.env.SENDGRID_API_KEY) {
  console.error('SENDGRID_API_KEY not set in .env.local');
  process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Import all templates
const templates = await import('../src/lib/email/templates.ts');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://freeluma.com';

async function send(subject, html, headers) {
  try {
    await sgMail.send({
      to: TEST_EMAIL,
      from: { email: 'hello@freeluma.com', name: 'Free Luma' },
      subject,
      html,
      headers,
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
    });
    console.log(`  ✓ Sent: ${subject}`);
  } catch (err) {
    console.error(`  ✗ Failed: ${subject}`, err.response?.body || err.message);
  }
}

console.log(`\nSending all email templates to: ${TEST_EMAIL}\n`);

// ---- 1. Transactional emails ----
console.log('--- Transactional ---');

// Password reset
const resetHtml = templates.passwordResetTemplate(`${APP_URL}/reset-password?token=test-token-123`);
await send('Reset Your Password - Free Luma', resetHtml);

// Email verification
const verifyHtml = templates.verificationTemplate(`${APP_URL}/api/auth/verify-email?token=test-token-123`);
await send('Verify Your Email - Free Luma', verifyHtml);

// Email change verification
const changeHtml = templates.emailChangeVerificationTemplate(TEST_EMAIL, `${APP_URL}/api/auth/verify-email-change?token=test-token-123`);
await send('Verify Your New Email Address - Free Luma', changeHtml);

// Password change alert
const alertHtml = templates.passwordChangeAlertTemplate(TEST_EMAIL);
await send('Your password was changed - Free Luma', alertHtml);

// Account deletion
const delHtml = templates.accountDeletionTemplate('Gary', 'March 18, 2026', `${APP_URL}/login`);
await send('Your account is scheduled for deletion - Free Luma', delHtml);

// ---- 2. Notification emails ----
console.log('\n--- Notification ---');

// DM batch
const dm = templates.dmBatchEmail({
  recipientName: 'Gary',
  senderName: 'Sarah',
  messageCount: 3,
  lastMessagePreview: 'Hey! Are you coming to the workshop tomorrow?',
  conversationUrl: `${APP_URL}/chat/1`,
  unsubscribeUrl: `${APP_URL}/api/email/unsubscribe?token=test&category=dm`,
});
await send(dm.subject, dm.html, dm.headers);

// Follow request
const follow = templates.followRequestEmail({
  recipientName: 'Gary',
  actorName: 'Michael',
  actorAvatarUrl: null,
  profileUrl: `${APP_URL}/profile/michael_r`,
  unsubscribeUrl: `${APP_URL}/api/email/unsubscribe?token=test&category=follow`,
});
await send(follow.subject, follow.html, follow.headers);

// Prayer response
const prayer = templates.prayerResponseEmail({
  recipientName: 'Gary',
  actorName: 'Grace',
  prayerTitle: 'Please pray for my family during this difficult time',
  prayerUrl: `${APP_URL}/prayer-wall`,
  unsubscribeUrl: `${APP_URL}/api/email/unsubscribe?token=test&category=prayer`,
});
await send(prayer.subject, prayer.html, prayer.headers);

// Daily reminder
const daily = templates.dailyReminderEmail({
  recipientName: 'Gary',
  verseText: 'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.',
  verseReference: 'Jeremiah 29:11 (NIV)',
  dailyUrl: `${APP_URL}/`,
  unsubscribeUrl: `${APP_URL}/api/email/unsubscribe?token=test&category=daily_reminder`,
});
await send(daily.subject, daily.html, daily.headers);

// Reaction/comment batch
const rc = templates.reactionCommentBatchEmail({
  recipientName: 'Gary',
  items: [
    { type: 'reaction', actorName: 'Sarah', contentPreview: 'What a beautiful morning devotional...', emoji: '❤️', contentUrl: `${APP_URL}/feed/1` },
    { type: 'comment', actorName: 'David', contentPreview: 'This really spoke to me today', contentUrl: `${APP_URL}/feed/1` },
    { type: 'reply', actorName: 'Grace', contentPreview: 'Amen! Praying for you', contentUrl: `${APP_URL}/feed/2` },
  ],
  unsubscribeUrl: `${APP_URL}/api/email/unsubscribe?token=test&category=reaction_comment`,
});
await send(rc.subject, rc.html, rc.headers);

// ---- 3. Workshop emails ----
console.log('\n--- Workshop ---');

const workshopParams = {
  recipientName: 'Gary',
  workshopTitle: 'Morning Prayer Circle',
  workshopUrl: `${APP_URL}/workshops/1`,
  hostName: 'Pastor James',
  scheduledAt: 'Saturday, March 1, 7:00 AM',
  unsubscribeUrl: `${APP_URL}/api/email/unsubscribe?token=test&category=workshop`,
};

const reminder = templates.workshopReminderEmail(workshopParams);
await send(reminder.subject, reminder.html, reminder.headers);

const cancelled = templates.workshopCancelledEmail(workshopParams);
await send(cancelled.subject, cancelled.html, cancelled.headers);

const invite = templates.workshopInviteEmail(workshopParams);
await send(invite.subject, invite.html, invite.headers);

const recording = templates.workshopRecordingEmail({ ...workshopParams, recordingUrl: `${APP_URL}/watch/5` });
await send(recording.subject, recording.html, recording.headers);

const updated = templates.workshopUpdatedEmail(workshopParams);
await send(updated.subject, updated.html, updated.headers);

const started = templates.workshopStartedEmail(workshopParams);
await send(started.subject, started.html, started.headers);

// ---- 4. New video email ----
console.log('\n--- New Video ---');

const video = templates.newVideoEmail({
  recipientName: 'Gary',
  videoTitle: 'Finding Peace in Troubled Times',
  videoDescription: 'A powerful message about finding inner peace through faith when the world around you feels chaotic. Join us for this inspiring 20-minute video.',
  videoThumbnailUrl: '',
  videoUrl: `${APP_URL}/watch/10`,
  unsubscribeUrl: `${APP_URL}/api/email/unsubscribe?token=test&category=new_video`,
});
await send(video.subject, video.html, video.headers);

console.log(`\n✓ All done! Check ${TEST_EMAIL} inbox.\n`);
console.log('Total emails sent: 16');
console.log('  5 transactional (reset, verify, email change, password alert, account deletion)');
console.log('  5 notification (DM batch, follow, prayer, daily reminder, reaction/comment batch)');
console.log('  6 workshop (reminder, cancelled, invite, recording, updated, started)');
console.log('  1 new video broadcast\n');
