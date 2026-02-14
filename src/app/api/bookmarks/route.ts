import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Bookmark,
  Post,
  PostMedia,
  User,
  DailyContent,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const toggleBookmarkSchema = z.object({
  post_id: z.number().int().positive().optional(),
  daily_content_id: z.number().int().positive().optional(),
}).refine(
  (data) => {
    const hasPost = data.post_id != null;
    const hasDaily = data.daily_content_id != null;
    return (hasPost && !hasDaily) || (!hasPost && hasDaily);
  },
  { message: 'Exactly one of post_id or daily_content_id must be provided' }
);

/**
 * GET /api/bookmarks — List user's bookmarks
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const cursor = searchParams.get('cursor');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
      const type = searchParams.get('type') || 'all';

      if (!['post', 'daily', 'all'].includes(type)) {
        return errorResponse('Invalid type. Must be post, daily, or all');
      }

      const where: Record<string, unknown> = {
        user_id: context.user.id,
      };

      if (type === 'post') {
        where.post_id = { [Op.ne]: null };
      } else if (type === 'daily') {
        where.daily_content_id = { [Op.ne]: null };
      }

      if (cursor) {
        where.created_at = { [Op.lt]: new Date(cursor) };
      }

      const bookmarks = await Bookmark.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: limit + 1,
        include: [
          {
            model: Post,
            as: 'post',
            attributes: ['id', 'user_id', 'body', 'post_type', 'visibility', 'mode', 'created_at'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'],
              },
              {
                model: PostMedia,
                as: 'media',
                attributes: ['id', 'url', 'media_type', 'thumbnail_url', 'width', 'height', 'sort_order'],
              },
            ],
            required: false,
          },
          {
            model: DailyContent,
            as: 'dailyContent',
            attributes: ['id', 'post_date', 'mode', 'title', 'content_text', 'verse_reference', 'video_background_url'],
            required: false,
          },
        ],
      });

      const has_more = bookmarks.length > limit;
      const items = has_more ? bookmarks.slice(0, limit) : bookmarks;
      const next_cursor = items.length > 0
        ? items[items.length - 1].created_at.toISOString()
        : null;

      return successResponse({
        bookmarks: items,
        next_cursor: has_more ? next_cursor : null,
        has_more,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch bookmarks');
    }
  }
);

/**
 * POST /api/bookmarks — Toggle bookmark on/off
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const json = await req.json();
      const parsed = toggleBookmarkSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { post_id, daily_content_id } = parsed.data;
      const userId = context.user.id;

      // Validate referenced content exists
      if (post_id) {
        const post = await Post.findByPk(post_id);
        if (!post) {
          return errorResponse('Post not found', 404);
        }
        // No bookmarks on prayer requests
        if (post.post_type === 'prayer_request') {
          return errorResponse('Cannot bookmark prayer requests', 400);
        }
      }

      if (daily_content_id) {
        const daily = await DailyContent.findByPk(daily_content_id);
        if (!daily) {
          return errorResponse('Daily content not found', 404);
        }
      }

      // Check if bookmark exists
      const where: Record<string, unknown> = { user_id: userId };
      if (post_id) where.post_id = post_id;
      if (daily_content_id) where.daily_content_id = daily_content_id;

      const existing = await Bookmark.findOne({ where });

      if (existing) {
        await existing.destroy();
        return successResponse({ action: 'removed' });
      }

      try {
        await Bookmark.create({
          user_id: userId,
          post_id: post_id ?? null,
          daily_content_id: daily_content_id ?? null,
        });
      } catch (err: unknown) {
        // Handle race condition: concurrent request already created bookmark
        if (err && typeof err === 'object' && 'name' in err && err.name === 'SequelizeUniqueConstraintError') {
          return successResponse({ action: 'added' }, 200);
        }
        throw err;
      }

      return successResponse({ action: 'added' }, 201);
    } catch (error) {
      return serverError(error, 'Failed to toggle bookmark');
    }
  }
);
