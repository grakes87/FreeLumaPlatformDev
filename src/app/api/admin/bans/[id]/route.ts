import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * PUT /api/admin/bans/[id] - Lift a ban early
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Ban, User, ModerationLog, sequelize } = await import('@/lib/db/models');

    const params = await context.params;
    const banId = parseInt(params.id, 10);
    if (isNaN(banId)) {
      return errorResponse('Invalid ban ID', 400);
    }

    const ban = await Ban.findByPk(banId);
    if (!ban) {
      return errorResponse('Ban not found', 404);
    }

    if (ban.lifted_at) {
      return errorResponse('Ban has already been lifted', 409);
    }

    const adminId = context.user.id;
    const transaction = await sequelize.transaction();

    try {
      // Lift the ban
      await ban.update({ lifted_at: new Date() }, { transaction });

      // Restore user status
      await User.update(
        { status: 'active' },
        { where: { id: ban.user_id }, transaction }
      );

      // Log action
      await ModerationLog.create(
        {
          admin_id: adminId,
          action: 'unban_user',
          target_user_id: ban.user_id,
          reason: 'Ban lifted early by admin',
          metadata: JSON.stringify({ ban_id: banId, original_reason: ban.reason }),
        },
        { transaction }
      );

      await transaction.commit();

      return successResponse({ success: true, ban: ban.toJSON() });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    return serverError(error, 'Failed to lift ban');
  }
});
