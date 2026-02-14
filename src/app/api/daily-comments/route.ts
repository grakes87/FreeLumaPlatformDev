import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { withOptionalAuth, type OptionalAuthContext } from '@/lib/auth/middleware';
import { DailyComment, User } from '@/lib/db/models';
import { COMMENT_MAX_LENGTH } from '@/lib/utils/constants';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { fn, col, literal } from 'sequelize';

const createCommentSchema = z.object({
  daily_content_id: z.number().int().positive(),
  parent_id: z.number().int().positive().nullable().optional(),
  body: z.string().min(1, 'Comment cannot be empty').max(COMMENT_MAX_LENGTH, `Comment must be ${COMMENT_MAX_LENGTH} characters or less`),
});

const USER_ATTRIBUTES = ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'] as const;

export const GET = withOptionalAuth(
  async (req: NextRequest, _context: OptionalAuthContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const dailyContentId = parseInt(searchParams.get('daily_content_id') || '', 10);

      if (!dailyContentId || isNaN(dailyContentId)) {
        return errorResponse('daily_content_id is required');
      }

      const parentIdParam = searchParams.get('parent_id');
      const parentId = parentIdParam === null || parentIdParam === 'null'
        ? null
        : parseInt(parentIdParam, 10);

      const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
      const offset = parseInt(searchParams.get('offset') || '0', 10);

      const where: Record<string, unknown> = {
        daily_content_id: dailyContentId,
        parent_id: parentId,
      };

      const { count: total, rows: comments } = await DailyComment.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'user',
            attributes: [...USER_ATTRIBUTES],
          },
        ],
        attributes: {
          include: [
            [
              literal(
                `(SELECT COUNT(*) FROM daily_comments AS r WHERE r.parent_id = \`DailyComment\`.\`id\`)`
              ),
              'reply_count',
            ],
          ],
        },
        order: [['created_at', 'ASC']],
        limit,
        offset,
      });

      return successResponse({
        comments: comments.map((c) => {
          const plain = c.toJSON() as unknown as Record<string, unknown>;
          return {
            ...plain,
            reply_count: parseInt(String(plain.reply_count || '0'), 10),
          };
        }),
        total,
        has_more: offset + comments.length < total,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch comments');
    }
  }
);

export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const body = await req.json();
      const parsed = createCommentSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { daily_content_id, parent_id, body: commentBody } = parsed.data;
      const user_id = context.user.id;

      // If parent_id is provided, verify it exists and belongs to the same content
      if (parent_id) {
        const parentComment = await DailyComment.findOne({
          where: { id: parent_id, daily_content_id },
        });
        if (!parentComment) {
          return errorResponse('Parent comment not found', 404);
        }
      }

      const comment = await DailyComment.create({
        user_id,
        daily_content_id,
        parent_id: parent_id ?? null,
        body: commentBody,
      });

      // Re-fetch with user data
      const full = await DailyComment.findByPk(comment.id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: [...USER_ATTRIBUTES],
          },
        ],
      });

      return successResponse(
        { ...full!.toJSON(), reply_count: 0 },
        201
      );
    } catch (error) {
      return serverError(error, 'Failed to create comment');
    }
  }
);
