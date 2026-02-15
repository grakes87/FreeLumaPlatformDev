import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const editUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(30).optional(),
  display_name: z.string().min(1).max(100).optional(),
  mode: z.enum(['bible', 'positivity']).optional(),
  is_verified: z.boolean().optional(),
  role: z.enum(['user', 'moderator', 'admin']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

/**
 * GET /api/admin/users/[id] - Get single user details
 */
export const GET = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { User, Ban } = await import('@/lib/db/models');
    const params = await context.params;
    const userId = parseInt(params.id, 10);

    if (isNaN(userId)) {
      return errorResponse('Invalid user ID', 400);
    }

    const user = await User.findByPk(userId, {
      attributes: [
        'id', 'email', 'username', 'display_name', 'avatar_url', 'avatar_color',
        'bio', 'role', 'status', 'is_admin', 'is_verified', 'mode',
        'email_verified', 'onboarding_complete',
        'created_at', 'last_login_at',
      ],
      paranoid: false,
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Fetch active ban if banned
    let activeBan = null;
    if (user.status === 'banned') {
      const { Op } = await import('sequelize');
      const ban = await Ban.findOne({
        where: {
          user_id: userId,
          lifted_at: null,
          [Op.or]: [
            { expires_at: null },
            { expires_at: { [Op.gt]: new Date() } },
          ],
        },
        order: [['created_at', 'DESC']],
      });
      if (ban) {
        activeBan = ban.toJSON();
      }
    }

    return successResponse({
      user: {
        ...user.toJSON(),
        active_ban: activeBan,
      },
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch user');
  }
});

/**
 * PUT /api/admin/users/[id] - Edit user details
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { User, ModerationLog } = await import('@/lib/db/models');

    const params = await context.params;
    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) {
      return errorResponse('Invalid user ID', 400);
    }

    const json = await req.json();
    const parsed = editUserSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const updates = parsed.data;
    const adminId = context.user.id;

    const user = await User.findByPk(userId, { paranoid: false });
    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Check for uniqueness conflicts
    if (updates.email && updates.email !== user.email) {
      const existing = await User.findOne({ where: { email: updates.email }, paranoid: false });
      if (existing) {
        return errorResponse('Email already in use', 409);
      }
    }

    if (updates.username && updates.username !== user.username) {
      const existing = await User.findOne({ where: { username: updates.username }, paranoid: false });
      if (existing) {
        return errorResponse('Username already in use', 409);
      }
    }

    // Track what changed for audit log
    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, newValue] of Object.entries(updates)) {
      const oldValue = (user as unknown as Record<string, unknown>)[key];
      if (oldValue !== newValue) {
        changedFields[key] = { from: oldValue, to: newValue };
      }
    }

    if (Object.keys(changedFields).length === 0) {
      return successResponse({ success: true, message: 'No changes detected' });
    }

    // Apply updates
    await user.update(updates);

    // Log action
    await ModerationLog.create({
      admin_id: adminId,
      action: 'edit_user',
      target_user_id: userId,
      reason: `Admin edited user fields: ${Object.keys(changedFields).join(', ')}`,
      metadata: JSON.stringify(changedFields),
    });

    return successResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        status: user.status,
        is_admin: user.is_admin,
        is_verified: user.is_verified,
        mode: user.mode,
      },
    });
  } catch (error) {
    return serverError(error, 'Failed to update user');
  }
});
