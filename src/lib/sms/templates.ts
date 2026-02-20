const APP_SHORT_URL = 'freeluma.app';

/**
 * SMS message templates per notification category.
 * Each template returns a message body under 160 characters.
 */
export const smsTemplates: Record<
  string,
  (preview: string | null, entityId: number) => string
> = {
  follow: (preview) =>
    `${preview || 'Someone'} followed you on Free Luma. ${APP_SHORT_URL}`,

  prayer: () =>
    `Someone prayed for your request on Free Luma. You're not alone. ${APP_SHORT_URL}`,

  message: () =>
    `New message on Free Luma. ${APP_SHORT_URL}/chat`,

  workshop_reminder: (_preview, entityId) =>
    `Reminder: Workshop starts in 1hr! ${APP_SHORT_URL}/workshops/${entityId}`,

  workshop_started: (_preview, entityId) =>
    `Workshop is live now! Join: ${APP_SHORT_URL}/workshops/${entityId}`,

  daily_reminder: () =>
    `Your daily inspiration is ready on Free Luma. Start your day with faith. ${APP_SHORT_URL}`,
};
