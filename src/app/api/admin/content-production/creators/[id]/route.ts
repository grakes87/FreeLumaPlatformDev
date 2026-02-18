import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { Op } from 'sequelize';

const updateCreatorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  bio: z.string().max(2000).nullable().optional(),
  link_1: z.string().url().max(500).nullable().optional(),
  link_2: z.string().url().max(500).nullable().optional(),
  link_3: z.string().url().max(500).nullable().optional(),
  languages: z.array(z.string().min(1)).min(1).optional(),
  monthly_capacity: z.number().int().min(1).max(100).optional(),
  can_bible: z.boolean().optional(),
  can_positivity: z.boolean().optional(),
  is_ai: z.boolean().optional(),
  heygen_avatar_id: z.string().max(255).nullable().optional(),
  heygen_voice_id: z.string().max(255).nullable().optional(),
});

/**
 * PUT /api/admin/content-production/creators/[id]
 * Update creator profile fields.
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { LumaShortCreator } = await import('@/lib/db/models');

    const params = await context.params;
    const creatorId = parseInt(params.id, 10);
    if (isNaN(creatorId)) {
      return errorResponse('Invalid creator ID', 400);
    }

    const creator = await LumaShortCreator.findByPk(creatorId);
    if (!creator) {
      return errorResponse('Creator not found', 404);
    }

    const json = await req.json();
    const parsed = updateCreatorSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    await creator.update(parsed.data);

    return successResponse({ creator: creator.toJSON() });
  } catch (error) {
    return serverError(error, 'Failed to update creator');
  }
});

/**
 * DELETE /api/admin/content-production/creators/[id]
 * Soft-deactivate a creator: set active=false and unassign pending work.
 */
export const DELETE = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { LumaShortCreator, DailyContent, sequelize } = await import('@/lib/db/models');

    const params = await context.params;
    const creatorId = parseInt(params.id, 10);
    if (isNaN(creatorId)) {
      return errorResponse('Invalid creator ID', 400);
    }

    const creator = await LumaShortCreator.findByPk(creatorId);
    if (!creator) {
      return errorResponse('Creator not found', 404);
    }

    if (!creator.active) {
      return errorResponse('Creator is already deactivated', 409);
    }

    const transaction = await sequelize.transaction();

    try {
      // Deactivate the creator
      await creator.update({ active: false }, { transaction });

      // Unassign pending work (generated or assigned status only)
      const [unassignedCount] = await DailyContent.update(
        { creator_id: null, status: 'generated' },
        {
          where: {
            creator_id: creatorId,
            status: { [Op.in]: ['generated', 'assigned'] },
          },
          transaction,
        }
      );

      await transaction.commit();

      return successResponse({ deactivated: true, unassigned_count: unassignedCount });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    return serverError(error, 'Failed to deactivate creator');
  }
});
