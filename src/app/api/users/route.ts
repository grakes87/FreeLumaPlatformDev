import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const profileUpdateSchema = z.object({
  display_name: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(100, 'Display name must be at most 100 characters')
    .optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-z0-9_]+$/,
      'Username must be lowercase alphanumeric and underscores only'
    )
    .optional(),
  bio: z
    .string()
    .max(160, 'Bio must be at most 160 characters')
    .nullable()
    .optional(),
  mode: z.enum(['bible', 'positivity']).optional(),
  avatar_url: z.string().max(500).nullable().optional(),
  avatar_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color')
    .optional(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .nullable()
    .optional(),
  timezone: z.string().max(50).optional(),
  preferred_translation: z.string().max(10).optional(),
  language: z.enum(['en', 'es']).optional(),
  profile_privacy: z.enum(['public', 'private']).optional(),
  location: z.string().max(200).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  denomination: z.string().max(100).nullable().optional(),
  church: z.string().max(200).nullable().optional(),
  onboarding_step: z.string().optional(),
  categories: z.array(z.number().int().positive()).optional(),
});

const handleProfileUpdate = async (req: NextRequest, context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid input';
      return errorResponse(firstError);
    }

    const { User, UserCategory } = await import('@/lib/db/models');
    const { categories, onboarding_step, ...profileFields } = parsed.data;

    // Check username uniqueness if updating
    if (profileFields.username) {
      const { Op } = await import('sequelize');
      const existingUser = await User.findOne({
        where: {
          username: profileFields.username,
          id: { [Op.ne]: context.user.id },
        },
      });
      if (existingUser) {
        return errorResponse('Username is already taken');
      }
    }

    // Build update fields
    const updateData: Record<string, unknown> = { ...profileFields };

    // Handle onboarding completion
    if (onboarding_step === 'complete') {
      updateData.onboarding_complete = true;
    }

    // Update user profile
    await User.update(updateData, {
      where: { id: context.user.id },
    });

    // Handle category selections (bulk replace)
    if (categories) {
      await UserCategory.destroy({
        where: { user_id: context.user.id },
      });

      if (categories.length > 0) {
        await UserCategory.bulkCreate(
          categories.map((category_id) => ({
            user_id: context.user.id,
            category_id,
          }))
        );
      }
    }

    // Fetch updated user
    const updatedUser = await User.findByPk(context.user.id, {
      attributes: {
        exclude: [
          'password_hash',
          'email_verification_token',
          'failed_login_attempts',
          'locked_until',
        ],
      },
    });

    return successResponse({ user: updatedUser });
  } catch (error) {
    return serverError(error, 'Failed to update profile');
  }
};

export const POST = withAuth(handleProfileUpdate);

export const PUT = withAuth(handleProfileUpdate);
