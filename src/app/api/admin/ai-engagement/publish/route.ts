/**
 * POST /api/admin/ai-engagement/publish
 *
 * Batch-inserts approved comments and reactions into the DB.
 * Comments get staggered timestamps to look natural.
 * Reactions use INSERT IGNORE to handle unique constraints.
 */

import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/auth/middleware';
import { sequelize } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import type { PublishRequest, PublishResponse } from '@/lib/ai-engagement/types';

export const POST = withAdmin(async (req: NextRequest) => {
  const transaction = await sequelize.transaction();

  try {
    const body: PublishRequest = await req.json();
    const { type, comments, reactions } = body;

    if (!type) {
      await transaction.rollback();
      return errorResponse('type is required');
    }

    let commentsInserted = 0;
    let reactionsInserted = 0;

    // --- Insert comments with staggered timestamps ---
    if (comments?.length > 0) {
      if (type === 'daily') {
        // daily_comments: user_id, daily_content_id, parent_id, body, edited, created_at, updated_at
        const values: string[] = [];
        const params: (string | number | null)[] = [];

        comments.forEach((c, idx) => {
          // Stagger: base offset 6h + spread across the day
          const hourOffset = 6 + Math.floor((idx / comments.length) * 14);
          const minOffset = Math.floor(Math.random() * 60);
          values.push('(?, ?, NULL, ?, 0, DATE_ADD(NOW(), INTERVAL ? HOUR) + INTERVAL ? MINUTE, NOW())');
          params.push(c.user_id, c.content_id, c.body, hourOffset, minOffset);
        });

        const [result] = await sequelize.query(
          `INSERT INTO daily_comments (user_id, daily_content_id, parent_id, body, edited, created_at, updated_at) VALUES ${values.join(',')}`,
          { replacements: params, transaction }
        );
        commentsInserted = (result as any).affectedRows ?? comments.length;
      } else {
        // verse_category_comments: user_id, verse_category_content_id, parent_id, body, edited, created_at, updated_at
        const values: string[] = [];
        const params: (string | number | null)[] = [];

        comments.forEach((c, idx) => {
          const hourOffset = 6 + Math.floor((idx / comments.length) * 14);
          const minOffset = Math.floor(Math.random() * 60);
          values.push('(?, ?, NULL, ?, 0, DATE_ADD(NOW(), INTERVAL ? HOUR) + INTERVAL ? MINUTE, NOW())');
          params.push(c.user_id, c.content_id, c.body, hourOffset, minOffset);
        });

        const [result] = await sequelize.query(
          `INSERT INTO verse_category_comments (user_id, verse_category_content_id, parent_id, body, edited, created_at, updated_at) VALUES ${values.join(',')}`,
          { replacements: params, transaction }
        );
        commentsInserted = (result as any).affectedRows ?? comments.length;
      }
    }

    // --- Insert reactions with INSERT IGNORE ---
    if (reactions?.length > 0) {
      if (type === 'daily') {
        const values: string[] = [];
        const params: (string | number)[] = [];

        reactions.forEach((r) => {
          values.push('(?, ?, ?, NOW(), NOW())');
          params.push(r.user_id, r.content_id, r.reaction_type);
        });

        const [result] = await sequelize.query(
          `INSERT IGNORE INTO daily_reactions (user_id, daily_content_id, reaction_type, created_at, updated_at) VALUES ${values.join(',')}`,
          { replacements: params, transaction }
        );
        reactionsInserted = (result as any).affectedRows ?? 0;
      } else {
        const values: string[] = [];
        const params: (string | number)[] = [];

        reactions.forEach((r) => {
          values.push('(?, ?, ?, NOW(), NOW())');
          params.push(r.user_id, r.content_id, r.reaction_type);
        });

        const [result] = await sequelize.query(
          `INSERT IGNORE INTO verse_category_reactions (user_id, verse_category_content_id, reaction_type, created_at, updated_at) VALUES ${values.join(',')}`,
          { replacements: params, transaction }
        );
        reactionsInserted = (result as any).affectedRows ?? 0;
      }
    }

    await transaction.commit();

    const response: PublishResponse = {
      comments_inserted: commentsInserted,
      reactions_inserted: reactionsInserted,
    };

    return successResponse(response);
  } catch (err) {
    await transaction.rollback();
    return serverError(err, 'Failed to publish engagement');
  }
});
