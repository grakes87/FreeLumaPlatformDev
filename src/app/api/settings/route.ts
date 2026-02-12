import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User, UserSetting } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const updateSettingsSchema = z.object({
  dark_mode: z.enum(['light', 'dark', 'system']).optional(),
  push_enabled: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  daily_reminder_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)')
    .optional(),
  mode: z.enum(['bible', 'positivity']).optional(),
  language: z.enum(['en', 'es']).optional(),
  preferred_translation: z.enum(['KJV', 'NIV', 'NRSV', 'NAB']).optional(),
  timezone: z.string().max(50).optional(),
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

      return successResponse({
        settings: {
          // From UserSetting
          dark_mode: settings.dark_mode,
          push_enabled: settings.push_enabled,
          email_notifications: settings.email_notifications,
          daily_reminder_time: settings.daily_reminder_time,
          // From User
          mode: user.mode,
          language: user.language,
          preferred_translation: user.preferred_translation,
          timezone: user.timezone,
          email: user.email,
          email_verified: user.email_verified,
        },
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
        push_enabled: boolean;
        email_notifications: boolean;
        daily_reminder_time: string;
      }> = {};

      const userFields: Partial<{
        mode: 'bible' | 'positivity';
        language: 'en' | 'es';
        preferred_translation: string;
        timezone: string;
      }> = {};

      if (data.dark_mode !== undefined) settingFields.dark_mode = data.dark_mode;
      if (data.push_enabled !== undefined) settingFields.push_enabled = data.push_enabled;
      if (data.email_notifications !== undefined) settingFields.email_notifications = data.email_notifications;
      if (data.daily_reminder_time !== undefined) settingFields.daily_reminder_time = data.daily_reminder_time;

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
          push_enabled: settings?.push_enabled ?? true,
          email_notifications: settings?.email_notifications ?? true,
          daily_reminder_time: settings?.daily_reminder_time || '08:00',
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
