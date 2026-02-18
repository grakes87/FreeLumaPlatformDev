import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User, UserSetting, BibleTranslation, VerseCategory } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const timeRegex = /^\d{2}:\d{2}$/;

const updateSettingsSchema = z.object({
  dark_mode: z.enum(['light', 'dark', 'system']).optional(),
  email_notifications: z.boolean().optional(),
  daily_reminder_time: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').optional(),
  quiet_hours_start: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').nullable().optional(),
  quiet_hours_end: z.string().regex(timeRegex, 'Invalid time format (HH:MM)').nullable().optional(),
  mode: z.enum(['bible', 'positivity']).optional(),
  verse_mode: z.enum(['daily_verse', 'verse_by_category']).optional(),
  verse_category_id: z.union([z.number().int().positive(), z.null()]).optional(),
  language: z.enum(['en', 'es']).optional(),
  preferred_translation: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  // Phase 3 notification preferences
  messaging_access: z.enum(['everyone', 'followers', 'mutual', 'nobody']).optional(),
  email_dm_notifications: z.boolean().optional(),
  email_follow_notifications: z.boolean().optional(),
  email_prayer_notifications: z.boolean().optional(),
  email_daily_reminder: z.boolean().optional(),
  email_reaction_comment_notifications: z.boolean().optional(),
  email_workshop_notifications: z.boolean().optional(),
  email_new_video_notifications: z.boolean().optional(),
  // Phase 13 phone + SMS notification preferences
  phone: z.null().optional(),  // null to clear phone number
  sms_notifications_enabled: z.boolean().optional(),
  sms_dm_notifications: z.boolean().optional(),
  sms_follow_notifications: z.boolean().optional(),
  sms_prayer_notifications: z.boolean().optional(),
  sms_daily_reminder: z.boolean().optional(),
  sms_workshop_notifications: z.boolean().optional(),
});

export const GET = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const user = await User.findByPk(context.user.id, {
        attributes: ['id', 'email', 'mode', 'language', 'preferred_translation', 'verse_mode', 'verse_category_id', 'timezone', 'email_verified', 'google_id', 'google_email', 'apple_id', 'phone', 'phone_verified'],
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
          email_reaction_comment_notifications: settings.email_reaction_comment_notifications,
          email_workshop_notifications: settings.email_workshop_notifications,
          email_new_video_notifications: settings.email_new_video_notifications,
          // SMS notification preferences
          sms_notifications_enabled: settings.sms_notifications_enabled,
          sms_dm_notifications: settings.sms_dm_notifications,
          sms_follow_notifications: settings.sms_follow_notifications,
          sms_prayer_notifications: settings.sms_prayer_notifications,
          sms_daily_reminder: settings.sms_daily_reminder,
          sms_workshop_notifications: settings.sms_workshop_notifications,
          // From User
          phone: user.phone,
          phone_verified: user.phone_verified,
          mode: user.mode,
          language: user.language,
          preferred_translation: user.preferred_translation,
          verse_mode: user.verse_mode || 'daily_verse',
          verse_category_id: user.verse_category_id ?? null,
          timezone: user.timezone,
          email: user.email,
          email_verified: user.email_verified,
          has_google: Boolean(user.google_id),
          google_email: user.google_email ?? null,
          has_apple: Boolean(user.apple_id),
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
        email_reaction_comment_notifications: boolean;
        email_workshop_notifications: boolean;
        email_new_video_notifications: boolean;
        sms_notifications_enabled: boolean;
        sms_dm_notifications: boolean;
        sms_follow_notifications: boolean;
        sms_prayer_notifications: boolean;
        sms_daily_reminder: boolean;
        sms_workshop_notifications: boolean;
      }> = {};

      const userFields: Partial<{
        mode: 'bible' | 'positivity';
        verse_mode: 'daily_verse' | 'verse_by_category';
        verse_category_id: number | null;
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
      if (data.email_reaction_comment_notifications !== undefined) settingFields.email_reaction_comment_notifications = data.email_reaction_comment_notifications;
      if (data.email_workshop_notifications !== undefined) settingFields.email_workshop_notifications = data.email_workshop_notifications;
      if (data.email_new_video_notifications !== undefined) settingFields.email_new_video_notifications = data.email_new_video_notifications;

      // SMS toggle fields — guard: phone must be verified before enabling any SMS toggle
      const smsToggles = [
        data.sms_notifications_enabled,
        data.sms_dm_notifications,
        data.sms_follow_notifications,
        data.sms_prayer_notifications,
        data.sms_daily_reminder,
        data.sms_workshop_notifications,
      ];
      const anySmsEnabling = smsToggles.some((v) => v === true);
      if (anySmsEnabling) {
        const smsUser = await User.findByPk(context.user.id, {
          attributes: ['phone_verified'],
        });
        if (!smsUser?.phone_verified) {
          return errorResponse('Phone number must be verified before enabling SMS notifications', 400);
        }
      }
      if (data.sms_notifications_enabled !== undefined) settingFields.sms_notifications_enabled = data.sms_notifications_enabled;
      if (data.sms_dm_notifications !== undefined) settingFields.sms_dm_notifications = data.sms_dm_notifications;
      if (data.sms_follow_notifications !== undefined) settingFields.sms_follow_notifications = data.sms_follow_notifications;
      if (data.sms_prayer_notifications !== undefined) settingFields.sms_prayer_notifications = data.sms_prayer_notifications;
      if (data.sms_daily_reminder !== undefined) settingFields.sms_daily_reminder = data.sms_daily_reminder;
      if (data.sms_workshop_notifications !== undefined) settingFields.sms_workshop_notifications = data.sms_workshop_notifications;

      // Phone clear: setting phone to null clears phone + phone_verified + disables all SMS
      if (data.phone === null) {
        await User.update(
          { phone: null, phone_verified: false },
          { where: { id: context.user.id } },
        );
        await UserSetting.update(
          { sms_notifications_enabled: false },
          { where: { user_id: context.user.id } },
        );
      }

      if (data.mode !== undefined) userFields.mode = data.mode;
      if (data.verse_mode !== undefined) {
        userFields.verse_mode = data.verse_mode;
        // When switching to daily_verse, clear category selection
        if (data.verse_mode === 'daily_verse') {
          userFields.verse_category_id = null;
        }
      }
      if (data.verse_category_id !== undefined) {
        if (data.verse_category_id !== null) {
          // Validate the category exists and is active
          const category = await VerseCategory.findByPk(data.verse_category_id);
          if (!category || !category.active) {
            return errorResponse('Invalid or inactive category', 400);
          }
        }
        userFields.verse_category_id = data.verse_category_id;
      }
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
        attributes: ['id', 'email', 'mode', 'language', 'preferred_translation', 'verse_mode', 'verse_category_id', 'timezone', 'email_verified', 'phone', 'phone_verified'],
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
          email_reaction_comment_notifications: settings?.email_reaction_comment_notifications ?? true,
          email_workshop_notifications: settings?.email_workshop_notifications ?? true,
          email_new_video_notifications: settings?.email_new_video_notifications ?? true,
          sms_notifications_enabled: settings?.sms_notifications_enabled ?? false,
          sms_dm_notifications: settings?.sms_dm_notifications ?? true,
          sms_follow_notifications: settings?.sms_follow_notifications ?? true,
          sms_prayer_notifications: settings?.sms_prayer_notifications ?? true,
          sms_daily_reminder: settings?.sms_daily_reminder ?? true,
          sms_workshop_notifications: settings?.sms_workshop_notifications ?? true,
          phone: user?.phone ?? null,
          phone_verified: user?.phone_verified ?? false,
          mode: user?.mode || 'bible',
          verse_mode: user?.verse_mode || 'daily_verse',
          verse_category_id: user?.verse_category_id ?? null,
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
