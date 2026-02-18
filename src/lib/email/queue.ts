import { Op } from 'sequelize';
import { SignJWT } from 'jose';
import { sendEmail } from './index';
import { generateTrackingId, markSent, markBounced } from './tracking';
import {
  dmBatchEmail,
  followRequestEmail,
  prayerResponseEmail,
  dailyReminderEmail,
  reactionCommentBatchEmail,
  workshopReminderEmail,
  workshopCancelledEmail,
  workshopInviteEmail,
  workshopRecordingEmail,
  workshopUpdatedEmail,
  workshopStartedEmail,
  newVideoEmail,
} from './templates';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://freeluma.com';

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
export function isInQuietHours(
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
 * Process batched reaction/comment email notifications.
 * Called by cron every 15 minutes.
 *
 * Finds users with unread reaction/comment notifications from the last 24 hours
 * (but older than 15 minutes to allow time for the user to see them in-app).
 * Groups by recipient and sends a single digest email per user.
 */
export async function processReactionCommentBatch(): Promise<void> {
  const { sequelize, User, UserSetting, EmailLog } = await import('@/lib/db/models');
  const { presenceManager } = await import('@/lib/socket/presence');

  const cutoffTime = new Date(Date.now() - DM_BATCH_DELAY_MINUTES * 60 * 1000);
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find recipients with unread reaction/comment notifications
  const recipientBatches = await sequelize.query<{
    recipient_id: number;
    notification_count: number;
  }>(`
    SELECT
      n.recipient_id,
      COUNT(*) AS notification_count
    FROM notifications n
    WHERE n.is_read = FALSE
      AND n.type IN ('reaction', 'comment')
      AND n.created_at <= :cutoffTime
      AND n.created_at >= :windowStart
    GROUP BY n.recipient_id
  `, {
    replacements: { cutoffTime, windowStart },
    type: 'SELECT' as never,
  }) as Array<{
    recipient_id: number;
    notification_count: number;
  }>;

  for (const batch of recipientBatches) {
    try {
      // Skip if recipient is online
      if (presenceManager.isOnline(batch.recipient_id)) continue;

      // Check if we already sent a reaction_comment_batch email recently (last 30 min)
      const recentEmailSent = await EmailLog.count({
        where: {
          recipient_id: batch.recipient_id,
          email_type: 'reaction_comment_batch',
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
          attributes: ['email_reaction_comment_notifications', 'quiet_hours_start', 'quiet_hours_end', 'reminder_timezone'],
        }],
      });

      if (!recipient) continue;
      const settings = (recipient as unknown as { settings: { email_reaction_comment_notifications: boolean; quiet_hours_start: string | null; quiet_hours_end: string | null; reminder_timezone: string | null } | null }).settings;
      if (!settings?.email_reaction_comment_notifications) continue;

      // Load the actual notifications with actor info
      const notifications = await sequelize.query<{
        type: string;
        entity_type: string;
        entity_id: number;
        preview_text: string | null;
        actor_name: string;
      }>(`
        SELECT n.type, n.entity_type, n.entity_id, n.preview_text,
               u.display_name AS actor_name
        FROM notifications n
        JOIN users u ON u.id = n.actor_id
        WHERE n.recipient_id = :recipientId
          AND n.is_read = FALSE
          AND n.type IN ('reaction', 'comment')
          AND n.created_at >= :windowStart
        ORDER BY n.created_at DESC
        LIMIT 10
      `, {
        replacements: { recipientId: batch.recipient_id, windowStart },
        type: 'SELECT' as never,
      }) as Array<{
        type: string;
        entity_type: string;
        entity_id: number;
        preview_text: string | null;
        actor_name: string;
      }>;

      if (notifications.length === 0) continue;

      // Map notifications to template items
      const items = notifications.map(n => {
        let itemType: 'reaction' | 'comment' | 'reply';
        if (n.type === 'reaction') {
          itemType = 'reaction';
        } else if (n.entity_type === 'comment') {
          itemType = 'reply';
        } else {
          itemType = 'comment';
        }

        return {
          type: itemType,
          actorName: n.actor_name,
          contentPreview: n.preview_text || 'your content',
          contentUrl: `${APP_URL}/post/${n.entity_id}`,
        };
      });

      // Build and send email
      const trackingId = generateTrackingId();
      const unsubscribeUrl = await generateUnsubscribeUrl(batch.recipient_id, 'reaction_comment');

      const { html, subject, headers } = reactionCommentBatchEmail({
        recipientName: recipient.display_name,
        items,
        trackingId,
        unsubscribeUrl,
      });

      await sendNotificationEmail({
        userId: batch.recipient_id,
        userEmail: recipient.email,
        emailType: 'reaction_comment_batch',
        subject,
        html,
        headers,
        trackingId,
        quietStart: settings.quiet_hours_start,
        quietEnd: settings.quiet_hours_end,
        reminderTimezone: settings.reminder_timezone,
      });
    } catch (err) {
      console.error(`[Email Queue] Reaction/comment batch error for user ${batch.recipient_id}:`, err);
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

      // ---- SMS daily reminder dispatch (fire-and-forget) ----
      try {
        const { dispatchSMSNotification } = await import('@/lib/sms/queue');
        await dispatchSMSNotification(
          user.id,
          'daily_reminder',
          'daily_content',
          0, // no specific entity
          null
        );
      } catch (smsErr) {
        console.error(`[Email Queue] Daily SMS error for user ${user.id}:`, smsErr);
      }
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
  const { Notification, EmailLog, SmsLog } = await import('@/lib/db/models');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [notifCount, emailCount, smsCount] = await Promise.all([
    Notification.destroy({
      where: { created_at: { [Op.lt]: thirtyDaysAgo } },
    }),
    EmailLog.destroy({
      where: { created_at: { [Op.lt]: ninetyDaysAgo } },
    }),
    // Also clean up old SMS logs
    SmsLog.destroy({
      where: { created_at: { [Op.lt]: ninetyDaysAgo } },
    }),
  ]);

  if (notifCount > 0 || emailCount > 0 || smsCount > 0) {
    console.log(`[Email Queue] Cleanup: ${notifCount} notifications, ${emailCount} email logs, ${smsCount} SMS logs deleted`);
  }
}

// ---- Workshop email dispatcher ----

export type WorkshopEmailType =
  | 'workshop_reminder'
  | 'workshop_cancelled'
  | 'workshop_invite'
  | 'workshop_recording'
  | 'workshop_updated'
  | 'workshop_started';

/**
 * Send workshop lifecycle emails to an array of recipients.
 * Called directly when workshop events occur (immediate, not batched).
 *
 * Respects email_workshop_notifications user setting, quiet hours, and rate limits.
 */
export async function processWorkshopEmail(
  recipientIds: number[],
  workshopEmailType: WorkshopEmailType,
  workshopData: {
    workshopId: number;
    workshopTitle: string;
    hostName: string;
    scheduledAt?: string;
    recordingUrl?: string;
  }
): Promise<void> {
  const { User, UserSetting } = await import('@/lib/db/models');

  const workshopUrl = `${APP_URL}/workshops/${workshopData.workshopId}`;

  for (const recipientId of recipientIds) {
    try {
      // Load recipient with settings
      const recipient = await User.findByPk(recipientId, {
        attributes: ['id', 'email', 'display_name'],
        include: [{
          model: UserSetting,
          as: 'settings',
          attributes: ['email_workshop_notifications', 'quiet_hours_start', 'quiet_hours_end', 'reminder_timezone'],
        }],
      });

      if (!recipient) continue;
      const settings = (recipient as unknown as { settings: { email_workshop_notifications: boolean; quiet_hours_start: string | null; quiet_hours_end: string | null; reminder_timezone: string | null } | null }).settings;
      if (!settings?.email_workshop_notifications) continue;

      const trackingId = generateTrackingId();
      const unsubscribeUrl = await generateUnsubscribeUrl(recipientId, 'workshop');

      const commonParams = {
        recipientName: recipient.display_name,
        workshopTitle: workshopData.workshopTitle,
        workshopUrl,
        hostName: workshopData.hostName,
        scheduledAt: workshopData.scheduledAt,
        trackingId,
        unsubscribeUrl,
      };

      let result: { html: string; subject: string; headers: Record<string, string> };

      switch (workshopEmailType) {
        case 'workshop_reminder':
          result = workshopReminderEmail(commonParams);
          break;
        case 'workshop_cancelled':
          result = workshopCancelledEmail(commonParams);
          break;
        case 'workshop_invite':
          result = workshopInviteEmail(commonParams);
          break;
        case 'workshop_recording':
          result = workshopRecordingEmail({ ...commonParams, recordingUrl: workshopData.recordingUrl });
          break;
        case 'workshop_updated':
          result = workshopUpdatedEmail(commonParams);
          break;
        case 'workshop_started':
          result = workshopStartedEmail(commonParams);
          break;
      }

      await sendNotificationEmail({
        userId: recipientId,
        userEmail: recipient.email,
        emailType: workshopEmailType,
        subject: result.subject,
        html: result.html,
        headers: result.headers,
        trackingId,
        quietStart: settings.quiet_hours_start,
        quietEnd: settings.quiet_hours_end,
        reminderTimezone: settings.reminder_timezone,
      });
    } catch (err) {
      console.error(`[Email Queue] Workshop email (${workshopEmailType}) error for user ${recipientId}:`, err);
    }
  }
}

// ---- Video broadcast ----

/** Chunk size for video broadcast processing */
const VIDEO_BROADCAST_CHUNK_SIZE = 100;

/**
 * Process pending video broadcast emails in chunks.
 * Called by cron every 5 minutes.
 *
 * Uses PlatformSetting 'pending_video_broadcast' as a lightweight queue
 * with a cursor (lastProcessedUserId) to track progress across cron ticks.
 * Processes 100 users per tick.
 */
export async function processVideoBroadcast(): Promise<void> {
  const { PlatformSetting, Video, EmailLog, sequelize } = await import('@/lib/db/models');

  // Check for pending broadcast
  const pendingValue = await PlatformSetting.get('pending_video_broadcast');
  if (!pendingValue) return;

  let broadcastData: { videoId: number; lastProcessedUserId: number };
  try {
    broadcastData = JSON.parse(pendingValue);
  } catch {
    console.error('[Email Queue] Invalid pending_video_broadcast JSON, clearing');
    await PlatformSetting.destroy({ where: { key: 'pending_video_broadcast' } });
    return;
  }

  const { videoId, lastProcessedUserId } = broadcastData;

  // Load the video
  const video = await Video.findByPk(videoId, {
    attributes: ['id', 'title', 'description', 'thumbnail_url'],
    raw: true,
  });

  if (!video) {
    console.error(`[Email Queue] Video ${videoId} not found, clearing broadcast`);
    await PlatformSetting.destroy({ where: { key: 'pending_video_broadcast' } });
    return;
  }

  // Duplicate prevention: if this is a fresh broadcast (cursor at 0),
  // check if we already sent new_video emails for this video
  if (lastProcessedUserId === 0) {
    const existingCount = await EmailLog.count({
      where: {
        email_type: 'new_video',
        subject: { [Op.like]: `%${video.title}%` },
      },
    });
    if (existingCount > 0) {
      console.log(`[Email Queue] Video broadcast already sent for "${video.title}", clearing`);
      await PlatformSetting.destroy({ where: { key: 'pending_video_broadcast' } });
      return;
    }
  }

  // Load a chunk of eligible users
  const users = await sequelize.query<{
    id: number;
    email: string;
    display_name: string;
  }>(`
    SELECT u.id, u.email, u.display_name
    FROM users u
    JOIN user_settings us ON us.user_id = u.id
    WHERE u.id > :lastProcessedUserId
      AND u.status = 'active'
      AND us.email_new_video_notifications = TRUE
    ORDER BY u.id ASC
    LIMIT :chunkSize
  `, {
    replacements: {
      lastProcessedUserId,
      chunkSize: VIDEO_BROADCAST_CHUNK_SIZE,
    },
    type: 'SELECT' as never,
  }) as Array<{
    id: number;
    email: string;
    display_name: string;
  }>;

  let processedCount = 0;
  let lastId = lastProcessedUserId;

  for (const user of users) {
    try {
      const trackingId = generateTrackingId();
      const unsubscribeUrl = await generateUnsubscribeUrl(user.id, 'new_video');

      const videoDescription = video.description
        ? (video.description.length > 150 ? video.description.slice(0, 147) + '...' : video.description)
        : '';

      const { html, subject, headers } = newVideoEmail({
        recipientName: user.display_name,
        videoTitle: video.title,
        videoDescription,
        videoThumbnailUrl: video.thumbnail_url,
        videoUrl: `${APP_URL}/watch/${videoId}`,
        trackingId,
        unsubscribeUrl,
      });

      await sendNotificationEmail({
        userId: user.id,
        userEmail: user.email,
        emailType: 'new_video',
        subject,
        html,
        headers,
        trackingId,
        quietStart: null,
        quietEnd: null,
        reminderTimezone: null,
      });

      processedCount++;
      lastId = user.id;
    } catch (err) {
      console.error(`[Email Queue] Video broadcast error for user ${user.id}:`, err);
      lastId = user.id;
    }
  }

  // Update cursor or clear if done
  if (users.length >= VIDEO_BROADCAST_CHUNK_SIZE) {
    // More users to process -- update the cursor
    await PlatformSetting.set(
      'pending_video_broadcast',
      JSON.stringify({ videoId, lastProcessedUserId: lastId })
    );
  } else {
    // Broadcast complete -- clear the setting
    await PlatformSetting.destroy({ where: { key: 'pending_video_broadcast' } });
  }

  console.log(`[Email Queue] Video broadcast: processed ${processedCount} users for video ${videoId}`);
}

/**
 * Trigger a video broadcast email to all eligible users.
 * Sets the PlatformSetting queue entry that the cron will pick up.
 *
 * Call this when a new video is published.
 */
export async function triggerVideoBroadcast(videoId: number): Promise<void> {
  const { PlatformSetting } = await import('@/lib/db/models');
  await PlatformSetting.set(
    'pending_video_broadcast',
    JSON.stringify({ videoId, lastProcessedUserId: 0 })
  );
}
