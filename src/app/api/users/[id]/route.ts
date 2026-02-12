import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

// Public-safe fields for viewing any user's profile
const PUBLIC_ATTRIBUTES = [
  'id',
  'display_name',
  'username',
  'avatar_url',
  'avatar_color',
  'bio',
  'mode',
  'created_at',
];

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
    .max(150, 'Bio must be at most 150 characters')
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
    .optional(),
  timezone: z.string().max(50).optional(),
  preferred_translation: z.string().max(10).optional(),
  language: z.enum(['en', 'es']).optional(),
});

export const GET = withAuth(async (_req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const userId = parseInt(params.id, 10);

    if (isNaN(userId)) {
      return errorResponse('Invalid user ID', 400);
    }

    const { User } = await import('@/lib/db/models');

    const user = await User.findByPk(userId, {
      attributes: PUBLIC_ATTRIBUTES,
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    return successResponse({ user });
  } catch (error) {
    return serverError(error, 'Failed to fetch user');
  }
});

export const PUT = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const userId = parseInt(params.id, 10);

    if (isNaN(userId)) {
      return errorResponse('Invalid user ID', 400);
    }

    // Only allow updating own profile
    if (userId !== context.user.id) {
      return errorResponse('You can only update your own profile', 403);
    }

    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid input';
      return errorResponse(firstError);
    }

    const { User } = await import('@/lib/db/models');

    // Check username uniqueness if updating
    if (parsed.data.username) {
      const { Op } = await import('sequelize');
      const existingUser = await User.findOne({
        where: {
          username: parsed.data.username,
          id: { [Op.ne]: context.user.id },
        },
      });
      if (existingUser) {
        return errorResponse('Username is already taken');
      }
    }

    await User.update(parsed.data, {
      where: { id: context.user.id },
    });

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
    return serverError(error, 'Failed to update user');
  }
});
