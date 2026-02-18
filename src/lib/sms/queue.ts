import { Op } from 'sequelize';
import { sendSMS } from './index';
import { smsTemplates } from './templates';
import { isInQuietHours } from '@/lib/email/queue';

/**
 * Map notification type -> user_settings SMS column name.
 */
const SMS_CATEGORY_MAP: Record<string, string> = {
  follow: 'sms_follow_notifications',
  follow_request: 'sms_follow_notifications',
  prayer: 'sms_prayer_notifications',
  message: 'sms_dm_notifications',
  workshop_reminder: 'sms_workshop_notifications',
  workshop_started: 'sms_workshop_notifications',
  daily_reminder: 'sms_daily_reminder',
};

/** Max SMS messages per user per hour (lower than email due to cost) */
const MAX_SMS_PER_HOUR = 3;

/**
 * Check if user has exceeded the hourly SMS rate limit.
 * Returns true if rate limited (should NOT send).
 */
async function isRateLimitedSMS(userId: number): Promise<boolean> {
  const { SmsLog } = await import('@/lib/db/models');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentCount = await SmsLog.count({
    where: {
      recipient_id: userId,
      status: { [Op.in]: ['sent', 'delivered'] },
      sent_at: { [Op.gte]: oneHourAgo },
    },
  });

  return recentCount >= MAX_SMS_PER_HOUR;
}

/**
 * Dispatch an SMS notification to a user.
 *
 * Guard chain:
 * 1. Check notification type is SMS-eligible
 * 2. User has verified phone number
 * 3. Global SMS toggle enabled
 * 4. Per-category SMS toggle enabled
 * 5. Not in quiet hours
 * 6. Not rate limited
 * 7. Template exists for the type
 *
 * Fire-and-forget: never throws.
 */
export async function dispatchSMSNotification(
  recipientId: number,
  type: string,
  entityType: string,
  entityId: number,
  previewText: string | null
): Promise<void> {
  try {
    // 1. Check notification type is SMS-eligible
    const settingColumn = SMS_CATEGORY_MAP[type];
    if (!settingColumn) return;

    // 2. Load user and check phone
    const { User, UserSetting, SmsLog } = await import('@/lib/db/models');

    const user = await User.findByPk(recipientId, {
      attributes: ['id', 'phone', 'phone_verified'],
    });

    if (!user || !user.phone || !user.phone_verified) return;

    // 3. Load settings and check global toggle
    const settings = await UserSetting.findOne({
      where: { user_id: recipientId },
      attributes: [
        'sms_notifications_enabled',
        settingColumn,
        'quiet_hours_start',
        'quiet_hours_end',
        'reminder_timezone',
      ],
    });

    if (!settings || !settings.sms_notifications_enabled) return;

    // 4. Check per-category toggle
    const categoryEnabled = (settings as unknown as Record<string, boolean>)[settingColumn];
    if (!categoryEnabled) return;

    // 5. Check quiet hours
    if (isInQuietHours(settings.quiet_hours_start, settings.quiet_hours_end, settings.reminder_timezone)) return;

    // 6. Check rate limit
    if (await isRateLimitedSMS(recipientId)) return;

    // 7. Get SMS body from template
    const templateFn = smsTemplates[type];
    if (!templateFn) return;
    const body = templateFn(previewText, entityId);

    // Create SmsLog entry
    const smsLog = await SmsLog.create({
      recipient_id: recipientId,
      sms_type: type,
      body,
      status: 'queued',
    });

    // Send SMS
    const result = await sendSMS(user.phone, body);

    // Update log with result
    if (result.success) {
      await smsLog.update({
        status: 'sent',
        twilio_sid: result.sid || null,
        sent_at: new Date(),
      });
    } else {
      await smsLog.update({ status: 'failed' });
    }
  } catch (err) {
    // Fire-and-forget: log but never throw
    console.error(`[SMS Queue] Dispatch error for user ${recipientId}, type ${type}:`, err);
  }
}
