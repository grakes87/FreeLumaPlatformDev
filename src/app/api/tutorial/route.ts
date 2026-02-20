import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User } from '@/lib/db/models';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/tutorial — Check current tutorial status
 */
export const GET = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const user = await User.findByPk(context.user.id, {
        attributes: ['has_seen_tutorial'],
      });

      return successResponse({
        has_seen_tutorial: user?.has_seen_tutorial ?? false,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch tutorial status');
    }
  }
);

/**
 * PUT /api/tutorial — Mark tutorial complete or reset for replay
 *
 * Body: {} (marks complete) or { reset: true } (resets for replay)
 */
export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const body = await req.json().catch(() => ({}));
      const value = body.reset === true ? false : true;

      await User.update(
        { has_seen_tutorial: value },
        { where: { id: context.user.id } }
      );

      return successResponse({ has_seen_tutorial: value });
    } catch (error) {
      return serverError(error, 'Failed to update tutorial status');
    }
  }
);
