/**
 * POST /api/admin/ai-engagement/generate
 *
 * Generates AI comments (via Claude) and weighted-random reactions
 * for selected content items. Returns staged items held in memory —
 * nothing is written to the DB until the publish endpoint is called.
 */

import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/auth/middleware';
import { sequelize } from '@/lib/db/models';
import { QueryTypes } from 'sequelize';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { generateComments } from '@/lib/ai-engagement/comment-generator';
import { generateReactions } from '@/lib/ai-engagement/reaction-generator';
import type {
  GenerateRequest,
  GenerateResponse,
  StagedComment,
  StagedReaction,
  SeedUser,
} from '@/lib/ai-engagement/types';

const BATCH_SIZE = 3; // items per Claude call

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const body: GenerateRequest = await req.json();
    const { type, targets, comments_per_item, reactions_per_item, reaction_weights } = body;

    if (!type || !targets?.length) {
      return errorResponse('type and targets are required');
    }
    if (comments_per_item < 0 || comments_per_item > 20) {
      return errorResponse('comments_per_item must be 0-20');
    }
    if (reactions_per_item < 0 || reactions_per_item > 60) {
      return errorResponse('reactions_per_item must be 0-60');
    }

    // Fetch seed users
    const seedUsers = await sequelize.query<SeedUser>(
      `SELECT id, display_name, avatar_color
       FROM users
       WHERE email LIKE '%@ai-seed.freeluma.internal'
       ORDER BY id`,
      { type: QueryTypes.SELECT }
    );

    if (seedUsers.length === 0) {
      return errorResponse('No AI seed users found. Run seed-ai-engagement.mjs first.', 400);
    }

    // --- Generate comments (batched Claude calls) ---
    const allComments: StagedComment[] = [];

    if (comments_per_item > 0) {
      const batches: typeof targets[] = [];
      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        batches.push(targets.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        const commentMap = await generateComments(type, batch, comments_per_item);

        for (const target of batch) {
          const comments = commentMap.get(target.content_id) || [];
          // Shuffle seed users for this item
          const shuffled = [...seedUsers].sort(() => Math.random() - 0.5);

          comments.forEach((body, idx) => {
            const user = shuffled[idx % shuffled.length];
            allComments.push({
              user_id: user.id,
              user_display_name: user.display_name,
              user_avatar_color: user.avatar_color,
              content_id: target.content_id,
              body,
            });
          });
        }
      }
    }

    // --- Generate reactions (weighted random, no AI needed) ---
    const allReactions: StagedReaction[] = [];

    if (reactions_per_item > 0) {
      for (const target of targets) {
        const reactions = generateReactions(
          type,
          target.content_id,
          reactions_per_item,
          reaction_weights,
          seedUsers
        );
        allReactions.push(...reactions);
      }
    }

    const response: GenerateResponse = {
      comments: allComments,
      reactions: allReactions,
    };

    return successResponse(response);
  } catch (err) {
    return serverError(err, 'Failed to generate engagement');
  }
});
