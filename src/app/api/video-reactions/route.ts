import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { Video, VideoReaction } from '@/lib/db/models';
import { REACTION_TYPES } from '@/lib/utils/constants';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { fn, col } from 'sequelize';

const reactionSchema = z.object({
  video_id: z.number().int().positive(),
  reaction_type: z.enum(REACTION_TYPES),
});

/**
 * Helper: get aggregate reaction counts by type for a video.
 */
async function getReactionCounts(videoId: number) {
  const rows = await VideoReaction.findAll({
    where: { video_id: videoId },
    attributes: [
      'reaction_type',
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['reaction_type'],
    raw: true,
  }) as unknown as { reaction_type: string; count: string }[];

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    const c = parseInt(row.count, 10);
    counts[row.reaction_type] = c;
    total += c;
  }

  return { counts, total };
}

/**
 * GET /api/video-reactions?video_id=X
 * Get reaction counts and user's own reaction for a video.
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const videoId = parseInt(searchParams.get('video_id') || '', 10);

      if (!videoId || isNaN(videoId)) {
        return errorResponse('video_id is required');
      }

      const { counts, total } = await getReactionCounts(videoId);

      // Get user's own reaction
      let userReaction: string | null = null;
      const existing = await VideoReaction.findOne({
        where: {
          user_id: context.user.id,
          video_id: videoId,
        },
        attributes: ['reaction_type'],
      });
      userReaction = existing?.reaction_type ?? null;

      return successResponse({
        counts,
        total,
        user_reaction: userReaction,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch video reactions');
    }
  }
);

/**
 * POST /api/video-reactions
 * Toggle a video reaction (add, change type, or remove).
 * Same type -> remove (toggle off)
 * Different type -> update
 * No existing -> create
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const body = await req.json();
      const parsed = reactionSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { video_id, reaction_type } = parsed.data;
      const user_id = context.user.id;

      // Verify video exists
      const video = await Video.findByPk(video_id, { attributes: ['id'] });
      if (!video) {
        return errorResponse('Video not found', 404);
      }

      const existing = await VideoReaction.findOne({
        where: { user_id, video_id },
      });

      if (existing) {
        if (existing.reaction_type === reaction_type) {
          // Same type -- toggle off (remove)
          await existing.destroy();
          const { counts, total } = await getReactionCounts(video_id);
          return successResponse({ action: 'removed', reaction_type: null, reaction_counts: counts, total });
        } else {
          // Different type -- update
          await existing.update({ reaction_type });
          const { counts, total } = await getReactionCounts(video_id);
          return successResponse({ action: 'updated', reaction_type, reaction_counts: counts, total });
        }
      }

      // No existing reaction -- create
      await VideoReaction.create({ user_id, video_id, reaction_type });
      const { counts, total } = await getReactionCounts(video_id);
      return successResponse({ action: 'created', reaction_type, reaction_counts: counts, total });
    } catch (error) {
      return serverError(error, 'Failed to toggle video reaction');
    }
  }
);
