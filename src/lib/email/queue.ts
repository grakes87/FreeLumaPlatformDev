import { Op } from 'sequelize';
import { SignJWT } from 'jose';
import { sendEmail } from './index';
import { generateTrackingId, markSent, markBounced } from './tracking';
import {
  dmBatchEmail,
  followRequestEmail,
  prayerResponseEmail,
  dailyReminderEmail,
} from './templates';

const APP_URL = 'https://freeluma.com';

/** Max emails per user per hour */
const MAX_EMAILS_PER_HOUR = 5;

/** DM batch delay in minutes (only email about messages older than this) */
const DM_BATCH_DELAY_MINUTES = 15;

// ---- Helpers ----

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(jwtSecret);
}

/**
 * Generate a signed unsubscribe URL with a purpose-scoped JWT.
 * Token expires in 90 days.
 */
async function generateUnsubscribeUrl(userId: number, category: string): Promise<string> {
  const token = await new SignJWT({ user_id: userId, purpose: 'email_unsubscribe' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(getSecret());

  return `${APP_URL}/api/email/unsubscribe?token=${token}&category=${category}`;
}

/**
 * Check if user is within quiet hours.
 * Returns true if emails should be suppressed.
 */
function isInQuietHours(
  quietStart: string | null,
  quietEnd: string | null,
  reminderTimezone: string | null
): boolean {
  if (!quietStart || !quietEnd) return false;

  try {
    // Get current time in user's timezone
    const tz = reminderTimezone || 'UTC';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const currentMinutes = hour * 60 + minute;

    const [startH, startM] = quietStart.split(':').map(Number);
    const [endH, endM] = quietEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Normal range: e.g. 22:00 to 23:00
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight range: e.g. 22:00 to 07:00
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  } catch {
    return false;
  }
}

/**
 * Check if user has exceeded the hourly email rate limit.
 * Returns true if rate limited (should NOT send).
 */
async function isRateLimited(userId: number): Promise<boolean> {
  const { EmailLog } = await import('@/lib/db/models');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentCount = await EmailLog.count({
    where: {
      recipient_id: userId,
      status: { [Op.in]: ['sent', 'opened'] },
      sent_at: { [Op.gte]: oneHourAgo },
    },
  });

  return recentCount >= MAX_EMAILS_PER_HOUR;
}

/**
 * Create an EmailLog entry and send the email.
 * Handles rate limiting, quiet hours check, and tracking.
 */
async function sendNotificationEmail(params: {
  userId: number;
  userEmail: string;
  emailType: 'dm_batch' | 'follow_request' | 'prayer_response' | 'daily_reminder' | 'reaction_comment_batch' | 'workshop_reminder' | 'workshop_cancelled' | 'workshop_invite' | 'workshop_recording' | 'workshop_updated' | 'workshop_started' | 'new_video';
  subject: string;
  html: string;
  headers?: Record<string, string>;
  trackingId: string;
  quietStart: string | null;
  quietEnd: string | null;
  reminderTimezone: string | null;
}): Promise<boolean> {
  const { userId, userEmail, emailType, subject, html, headers, trackingId, quietStart, quietEnd, reminderTimezone } = params;

  // Check quiet hours
  if (isInQuietHours(quietStart, quietEnd, reminderTimezone)) {
    return false;
  }

  // Check rate limit
  if (await isRateLimited(userId)) {
    return false;
  }

  // Create EmailLog entry
  const { EmailLog } = await import('@/lib/db/models');
  const emailLog = await EmailLog.create({
    recipient_id: userId,
    email_type: emailType,
    subject,
    status: 'queued',
    tracking_id: trackingId,
  });

  try {
    await sendEmail(userEmail, subject, html, headers);
    await markSent(emailLog.id);
    return true;
  } catch (err) {
    console.error(`[Email Queue] Failed to send ${emailType} email to user ${userId}:`, err);
    await markBounced(emailLog.id);
    return false;
  }
}

// ---- Public API ----

/**
 * Process batched DM email notifications.
 * Called by cron every 5 minutes.
 *
 * Finds conversations with unread messages older than 15 minutes,
 * where the recipient is offline and has DM email notifications enabled.
 * Groups by sender: "You have X unread messages from Y"
 */
export async function processDMEmailBatch(): Promise<void> {
  const { sequelize, User, UserSetting, Message, ConversationParticipant, EmailLog } = await import('@/lib/db/models');
  const { presenceManager } = await import('@/lib/socket/presence');

  const cutoffTime = new Date(Date.now() - DM_BATCH_DELAY_MINUTES * 60 * 1000);

  // Find conversations with unread messages older than the cutoff
  // Use raw query for efficiency: find (conversation_id, sender_id, recipient_id, count, latest_content)
  const unreadBatches = await sequelize.query<{
    conversation_id: number;
    sender_id: number;
    recipient_id: number;
    message_count: number;
    latest_content: string | null;
  }>(`
    SELECT
      m.conversation_id,
      m.sender_id,
      cp.user_id AS recipient_id,
      COUNT(*) AS message_count,
      (SELECT content FROM messages m2 WHERE m2.conversation_id = m.conversation_id AND m2.sender_id = m.sender_id ORDER BY m2.created_at DESC LIMIT 1) AS latest_content
    FROM messages m
    JOIN conversation_participants cp
      ON cp.conversation_id = m.conversation_id
      AND cp.user_id != m.sender_id
      AND cp.deleted_at IS NULL
    WHERE m.created_at <= :cutoffTime
      AND m.created_at >= :windowStart
      AND m.is_unsent = FALSE
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
    GROUP BY m.conversation_id, m.sender_id, cp.user_id
  `, {
    replacements: {
      cutoffTime,
      // Only look at messages from the last 24 hours to avoid re-processing old ones
      windowStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
    type: 'SELECT' as never,
  }) as Array<{
    conversation_id: number;
    sender_id: number;
    recipient_id: number;
    message_count: number;
    latest_content: string | null;
  }>;

  for (const batch of unreadBatches) {
    try {
      // Skip if recipient is online
      if (presenceManager.isOnline(batch.recipient_id)) continue;

      // Check if we already sent a DM email for this sender recently (last 30 min)
      const recentEmailSent = await EmailLog.count({
        where: {
          recipient_id: batch.recipient_id,
          email_type: 'dm_batch',
          created_at: { [Op.gte]: new Date(Date.now() - 30 * 60 * 1000) },
        },
      });
      if (recentEmailSent > 0) continue;

      // Get recipient info and settings
      const recipient = await User.findByPk(batch.recipient_id, {
        attributes: ['id', 'email', 'display_name'],
        include: [{
          model: UserSetting,
          as: 'settings',
          attributes: ['email_dm_notifications', 'quiet_hours_start', 'quiet_hours_end', 'reminder_timezone'],
        }],
      });

      if (!recipient) continue;
      const settings = (recipient as unknown as { settings: { email_dm_notifications: boolean; quiet_hours_start: string | null; quiet_hours_end: string | null; reminder_timezone: string | null } | null }).settings;
      if (!settings?.email_dm_notifications) continue;

      // Get sender info
      const sender = await User.findByPk(batch.sender_id, {
        attributes: ['display_name'],
        raw: true,
      });
      if (!sender) continue;

      // Build email
      const trackingId = generateTrackingId();
      const unsubscribeUrl = await generateUnsubscribeUrl(batch.recipient_id, 'dm');
      const messagePreview = batch.latest_content
        ? batch.latest_content.slice(0, 100) + (batch.latest_content.length > 100 ? '...' : '')
        : 'Sent you a message';

      const { html, subject, headers } = dmBatchEmail({
        recipientName: recipient.display_name,
        senderName: sender.display_name,
        messageCount: Number(batch.message_count),
        messagePreview,
        conversationUrl: `${APP_URL}/chat/${batch.conversation_id}`,
        trackingId,
        unsubscribeUrl,
      });

      await sendNotificationEmail({
        userId: batch.recipient_id,
        userEmail: recipient.email,
        emailType: 'dm_batch',
        subject,
        html,
        headers,
        trackingId,
        quietStart: settings.quiet_hours_start,
        quietEnd: settings.quiet_hours_end,
        reminderTimezone: settings.reminder_timezone,
      });
    } catch (err) {
      console.error(`[Email Queue] DM batch error for conversation ${batch.conversation_id}:`, err);
    }
  }
}

/**
 * Process daily content reminder emails.
 * Called by cron at the top of each hour.
 *
 * Finds users whose daily_reminder_time matches the current hour
 * in their reminder_timezone.
 */
export async function processDailyReminders(): Promise<void> {
  const { User, UserSetting, DailyContent } = await import('@/lib/db/models');

  // Get current hour in different timezones by querying users
  // whose reminder time matches now in their timezone
  const now = new Date();

  // Get all users with daily reminder enabled
  const users = await User.findAll({
    attributes: ['id', 'email', 'display_name', 'mode'],
    include: [{
      model: UserSetting,
      as: 'settings',
      attributes: [
        'email_daily_reminder',
        'daily_reminder_time',
        'reminder_timezone',
        'quiet_hours_start',
        'quiet_hours_end',
      ],
      where: {
        email_daily_reminder: true,
      },
    }],
    raw: true,
    nest: true,
  });

  // Get today's daily content for both modes
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const [bibleContent, positivityContent] = await Promise.all([
    DailyContent.findOne({
      where: { post_date: today, mode: 'bible', published: true },
      raw: true,
    }),
    DailyContent.findOne({
      where: { post_date: today, mode: 'positivity', published: true },
      raw: true,
    }),
  ]);

  for (const user of (users as unknown) as Array<{
    id: number;
    email: string;
    display_name: string;
    mode: 'bible' | 'positivity';
    settings: {
      email_daily_reminder: boolean;
      daily_reminder_time: string;
      reminder_timezone: string | null;
      quiet_hours_start: string | null;
      quiet_hours_end: string | null;
    };
  }>) {
    try {
      const settings = user.settings;
      if (!settings?.email_daily_reminder) continue;

      // Check if current hour matches user's reminder time in their timezone
      const tz = settings.reminder_timezone || 'UTC';
      const [reminderH] = settings.daily_reminder_time.split(':').map(Number);

      let userHour: number;
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: '2-digit',
          hour12: false,
        });
        const parts = formatter.formatToParts(now);
        userHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      } catch {
        // Invalid timezone, default to UTC
        userHour = now.getUTCHours();
      }

      if (userHour !== reminderH) continue;

      // Get the daily content matching the user's mode
      const content = user.mode === 'bible' ? bibleContent : positivityContent;
      if (!content) continue;

      const trackingId = generateTrackingId();
      const unsubscribeUrl = await generateUnsubscribeUrl(user.id, 'daily_reminder');

      const verseText = content.content_text.slice(0, 200) +
        (content.content_text.length > 200 ? '...' : '');
      const verseReference = content.verse_reference || content.title;

      const { html, subject, headers } = dailyReminderEmail({
        recipientName: user.display_name,
        verseText,
        verseReference,
        dailyUrl: `${APP_URL}/`,
        trackingId,
        unsubscribeUrl,
      });

      await sendNotificationEmail({
        userId: user.id,
        userEmail: user.email,
        emailType: 'daily_reminder',
        subject,
        html,
        headers,
        trackingId,
        quietStart: settings.quiet_hours_start,
        quietEnd: settings.quiet_hours_end,
        reminderTimezone: settings.reminder_timezone,
      });
    } catch (err) {
      console.error(`[Email Queue] Daily reminder error for user ${user.id}:`, err);
    }
  }
}

/**
 * Send a follow request email notification immediately (not batched).
 * Called directly from createNotification flow.
 */
export async function processFollowRequestEmail(userId: number, actorId: number): Promise<void> {
  const { User, UserSetting } = await import('@/lib/db/models');

  // Get recipient and settings
  const recipient = await User.findByPk(userId, {
    attributes: ['id', 'email', 'display_name'],
    include: [{
      model: UserSetting,
      as: 'settings',
      attributes: ['email_follow_notifications', 'quiet_hours_start', 'quiet_hours_end', 'reminder_timezone'],
    }],
  });

  if (!recipient) return;
  const settings = (recipient as unknown as { settings: { email_follow_notifications: boolean; quiet_hours_start: string | null; quiet_hours_end: string | null; reminder_timezone: string | null } | null }).settings;
  if (!settings?.email_follow_notifications) return;

  // Get actor info
  const actor = await User.findByPk(actorId, {
    attributes: ['display_name', 'username', 'avatar_url'],
    raw: true,
  });
  if (!actor) return;

  const trackingId = generateTrackingId();
  const unsubscribeUrl = await generateUnsubscribeUrl(userId, 'follow');

  const { html, subject, headers } = followRequestEmail({
    recipientName: recipient.display_name,
    actorName: actor.display_name,
    actorAvatarUrl: actor.avatar_url,
    profileUrl: `${APP_URL}/profile/${actor.username}`,
    trackingId,
    unsubscribeUrl,
  });

  await sendNotificationEmail({
    userId,
    userEmail: recipient.email,
    emailType: 'follow_request',
    subject,
    html,
    headers,
    trackingId,
    quietStart: settings.quiet_hours_start,
    quietEnd: settings.quiet_hours_end,
    reminderTimezone: settings.reminder_timezone,
  });
}

/**
 * Send a prayer response email notification immediately (not batched).
 * Called directly from createNotification flow.
 */
export async function processPrayerResponseEmail(
  userId: number,
  actorId: number,
  prayerRequestId: number
): Promise<void> {
  const { User, UserSetting, Post, PrayerRequest } = await import('@/lib/db/models');

  // Get recipient and settings
  const recipient = await User.findByPk(userId, {
    attributes: ['id', 'email', 'display_name'],
    include: [{
      model: UserSetting,
      as: 'settings',
      attributes: ['email_prayer_notifications', 'quiet_hours_start', 'quiet_hours_end', 'reminder_timezone'],
    }],
  });

  if (!recipient) return;
  const settings = (recipient as unknown as { settings: { email_prayer_notifications: boolean; quiet_hours_start: string | null; quiet_hours_end: string | null; reminder_timezone: string | null } | null }).settings;
  if (!settings?.email_prayer_notifications) return;

  // Get actor info
  const actor = await User.findByPk(actorId, {
    attributes: ['display_name'],
    raw: true,
  });
  if (!actor) return;

  // Get prayer request info
  const prayerRequest = await PrayerRequest.findByPk(prayerRequestId, {
    attributes: ['post_id'],
    include: [{
      model: Post,
      as: 'post',
      attributes: ['body'],
    }],
  });
  if (!prayerRequest) return;

  const postBody = (prayerRequest as unknown as { post: { body: string } | null }).post?.body || 'Prayer request';

  const trackingId = generateTrackingId();
  const unsubscribeUrl = await generateUnsubscribeUrl(userId, 'prayer');

  const { html, subject, headers } = prayerResponseEmail({
    recipientName: recipient.display_name,
    actorName: actor.display_name,
    prayerTitle: postBody,
    prayerUrl: `${APP_URL}/prayer-wall`,
    trackingId,
    unsubscribeUrl,
  });

  await sendNotificationEmail({
    userId,
    userEmail: recipient.email,
    emailType: 'prayer_response',
    subject,
    html,
    headers,
    trackingId,
    quietStart: settings.quiet_hours_start,
    quietEnd: settings.quiet_hours_end,
    reminderTimezone: settings.reminder_timezone,
  });
}

/**
 * Clean up old notifications and email logs.
 * Called by cron daily at 3 AM.
 *
 * - Delete notifications older than 30 days
 * - Delete email_logs older than 90 days
 */
export async function cleanupOldNotifications(): Promise<void> {
  const { Notification, EmailLog } = await import('@/lib/db/models');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [notifCount, emailCount] = await Promise.all([
    Notification.destroy({
      where: { created_at: { [Op.lt]: thirtyDaysAgo } },
    }),
    EmailLog.destroy({
      where: { created_at: { [Op.lt]: ninetyDaysAgo } },
    }),
  ]);

  if (notifCount > 0 || emailCount > 0) {
    console.log(`[Email Queue] Cleanup: ${notifCount} notifications, ${emailCount} email logs deleted`);
  }
}
