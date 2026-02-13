import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User, UserSetting, BibleTranslation } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const timeRegex = /^\d{2}:\d{2}$/;

const updateSettingsSchema = z.object({
  dark_mode: z.enum(['light', 'dark', 'system']).optional(),
  email_notifications: z.boolean().optional(),
  daily_reminder_time: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
  quiet_hours_start: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').nullable().optional(),
  quiet_hours_end: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').nullable().optional(),
  mode: z.enum(['bible', 'positivity']).optional(),
  language: z.enum(['en', 'es']).optional(),
  preferred_translation: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  // Phase 3 notification preferences
  messaging_access: z.enum(['everyone', 'followers', 'mutual', 'nobody']).optional(),
  email_dm_notifications: z.boolean().optional(),
  email_follow_notifications: z.boolean().optional(),
  email_prayer_notifications: z.boolean().optional(),
  email_daily_reminder: z.boolean().optional(),
});

export const GET = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'email', 'mode', 'language', 'preferred_translation', 'timezone', 'email_verified'],
      });

      if (!user) {
        return errorResponse('User not found', 404);
      }

      let settings = await UserSetting.findOne({
        where: { user_id: context.user.id },
      });

      // Create default settings if they don't exist
      if (!settings) {
        settings = await UserSetting.create({ user_id: context.user.id });
      }

      // Fetch available Bible translations
      const bibleTranslations = await BibleTranslation.findAll({
        where: { active: true },
        attributes: ['code', 'name', 'language'],
        order: [['language', 'ASC'], ['code', 'ASC']],
      });

      return successResponse({
        settings: {
          // From UserSetting
          dark_mode: settings.dark_mode,
          email_notifications: settings.email_notifications,
          daily_reminder_time: settings.daily_reminder_time,
          quiet_hours_start: settings.quiet_hours_start,
          quiet_hours_end: settings.quiet_hours_end,
          messaging_access: settings.messaging_access,
          email_dm_notifications: settings.email_dm_notifications,
          email_follow_notifications: settings.email_follow_notifications,
          email_prayer_notifications: settings.email_prayer_notifications,
          email_daily_reminder: settings.email_daily_reminder,
          // From User
          mode: user.mode,
          language: user.language,
          preferred_translation: user.preferred_translation,
          timezone: user.timezone,
          email: user.email,
          email_verified: user.email_verified,
        },
        translations: bibleTranslations.map((t) => ({
          code: t.code,
          name: t.name,
          language: t.language,
        })),
      });
    } catch (error) {
      return serverError(error, 'Failed to get settings');
    }
  }
);

export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const body = await req.json();
      const parsed = updateSettingsSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const data = parsed.data;

      // Split updates between UserSetting fields and User fields
      const settingFields: Partial<{
        dark_mode: 'light' | 'dark' | 'system';
        email_notifications: boolean;
        daily_reminder_time: string;
        quiet_hours_start: string | null;
        quiet_hours_end: string | null;
        messaging_access: 'everyone' | 'followers' | 'mutual' | 'nobody';
        email_dm_notifications: boolean;
        email_follow_notifications: boolean;
        email_prayer_notifications: boolean;
        email_daily_reminder: boolean;
      }> = {};

      const userFields: Partial<{
        mode: 'bible' | 'positivity';
        language: 'en' | 'es';
        preferred_translation: string;
        timezone: string;
      }> = {};

      if (data.dark_mode !== undefined) settingFields.dark_mode = data.dark_mode;
      if (data.email_notifications !== undefined) settingFields.email_notifications = data.email_notifications;
      if (data.daily_reminder_time !== undefined) settingFields.daily_reminder_time = data.daily_reminder_time;
      if (data.quiet_hours_start !== undefined) settingFields.quiet_hours_start = data.quiet_hours_start;
      if (data.quiet_hours_end !== undefined) settingFields.quiet_hours_end = data.quiet_hours_end;
      if (data.messaging_access !== undefined) settingFields.messaging_access = data.messaging_access;
      if (data.email_dm_notifications !== undefined) settingFields.email_dm_notifications = data.email_dm_notifications;
      if (data.email_follow_notifications !== undefined) settingFields.email_follow_notifications = data.email_follow_notifications;
      if (data.email_prayer_notifications !== undefined) settingFields.email_prayer_notifications = data.email_prayer_notifications;
      if (data.email_daily_reminder !== undefined) settingFields.email_daily_reminder = data.email_daily_reminder;

      if (data.mode !== undefined) userFields.mode = data.mode;
      if (data.language !== undefined) userFields.language = data.language;
      if (data.preferred_translation !== undefined) userFields.preferred_translation = data.preferred_translation;
      if (data.timezone !== undefined) userFields.timezone = data.timezone;

      // Update UserSetting if there are setting fields
      if (Object.keys(settingFields).length > 0) {
        let settings = await UserSetting.findOne({
          where: { user_id: context.user.id },
        });

        if (!settings) {
          settings = await UserSetting.create({
            user_id: context.user.id,
            ...settingFields,
          });
        } else {
          await settings.update(settingFields);
        }
      }

      // Update User if there are user fields
      if (Object.keys(userFields).length > 0) {
        await User.update(userFields, {
          where: { id: context.user.id },
        });
      }

      // Fetch and return updated settings
      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'email', 'mode', 'language', 'preferred_translation', 'timezone', 'email_verified'],
      });

      const settings = await UserSetting.findOne({
        where: { user_id: context.user.id },
      });

      return successResponse({
        settings: {
          dark_mode: settings?.dark_mode || 'system',
          email_notifications: settings?.email_notifications ?? true,
          daily_reminder_time: settings?.daily_reminder_time || '08:00',
          quiet_hours_start: settings?.quiet_hours_start ?? null,
          quiet_hours_end: settings?.quiet_hours_end ?? null,
          messaging_access: settings?.messaging_access || 'mutual',
          email_dm_notifications: settings?.email_dm_notifications ?? true,
          email_follow_notifications: settings?.email_follow_notifications ?? true,
          email_prayer_notifications: settings?.email_prayer_notifications ?? true,
          email_daily_reminder: settings?.email_daily_reminder ?? true,
          mode: user?.mode || 'bible',
          language: user?.language || 'en',
          preferred_translation: user?.preferred_translation || 'KJV',
          timezone: user?.timezone || 'America/New_York',
          email: user?.email || '',
          email_verified: user?.email_verified ?? false,
        },
      });
    } catch (error) {
      return serverError(error, 'Failed to update settings');
    }
  }
);
