import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Post,
  PostComment,
  PostMedia,
  PrayerRequest,
  PrayerSupport,
  Repost,
  User,
} from '@/lib/db/models';
import { sequelize } from '@/lib/db';
import { checkAndFlag } from '@/lib/moderation/profanity';
import { encodeCursor, decodeCursor } from '@/lib/utils/cursor';
import { getBlockedUserIds } from '@/lib/utils/blocks';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const PRAYER_BODY_MAX = 5000;

const createPrayerSchema = z.object({
  body: z
    .string()
    .min(1, 'Prayer request body is required')
    .max(PRAYER_BODY_MAX, `Prayer request must be ${PRAYER_BODY_MAX} characters or less`),
  privacy: z.enum(['public', 'followers']).default('public'),
  is_anonymous: z.boolean().default(false),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        media_type: z.enum(['image', 'video']),
        thumbnail_url: z.string().url().nullable().optional(),
        width: z.number().int().positive().nullable().optional(),
        height: z.number().int().positive().nullable().optional(),
        duration: z.number().int().positive().nullable().optional(),
        sort_order: z.number().int().min(0).optional(),
      })
    )
    .max(10)
    .default([]),
});

type TabType = 'others' | 'my_requests' | 'my_joined';
type StatusFilter = 'all' | 'active' | 'answered';

const ANONYMOUS_AUTHOR = {
  id: 0,
  username: 'anonymous',
  display_name: 'Anonymous',
  avatar_url: null,
  avatar_color: '#9CA3AF',
};

/**
 * Mask author info for anonymous prayers when viewer is not the author.
 */
function maskAnonymous(prayer: Record<string, unknown>, requestingUserId: number) {
  const post = prayer.post as Record<string, unknown> | undefined;
  if (!post) return prayer;

  const isAnonymous = post.is_anonymous as boolean;
  const authorId = post.user_id as number;

  if (isAnonymous && authorId !== requestingUserId) {
    return {
      ...prayer,
      post: {
        ...post,
        user: ANONYMOUS_AUTHOR,
      },
    };
  }
  return prayer;
}

/**
 * GET /api/prayer-requests - Prayer wall feed with tabs and filters
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;

      // Check bible-mode restriction
      const user = await User.findByPk(userId, { attributes: ['id', 'mode'] });
      if (!user) {
        return errorResponse('User not found', 404);
      }
      if (user.mode === 'positivity') {
        return errorResponse('Prayer wall is available in Bible mode', 403);
      }

      const { searchParams } = new URL(req.url);
      const cursor = searchParams.get('cursor');
      const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 50);
      const tab = (searchParams.get('tab') || 'others') as TabType;
      const statusFilter = (searchParams.get('status') || 'all') as StatusFilter;

      // Validate tab and status
      if (!['others', 'my_requests', 'my_joined'].includes(tab)) {
        return errorResponse('Invalid tab parameter');
      }
      if (!['all', 'active', 'answered'].includes(statusFilter)) {
        return errorResponse('Invalid status parameter');
      }

      // Get blocked user IDs
      const blockedIds = await getBlockedUserIds(userId);

      // Build where conditions for Post
      const postWhere: Record<string, unknown> = {
        post_type: 'prayer_request',
        deleted_at: null,
      };

      // Exclude blocked users
      if (blockedIds.size > 0) {
        postWhere.user_id = { [Op.notIn]: Array.from(blockedIds) };
      }

      // Build where conditions for PrayerRequest
      const prayerWhere: Record<string, unknown> = {};

      // Status filter
      if (statusFilter !== 'all') {
        prayerWhere.status = statusFilter;
      }

      // Tab logic
      if (tab === 'others') {
        // Community tab: all public prayers except the user's own
        const excludeIds = new Set([userId, ...Array.from(blockedIds)]);
        postWhere.user_id = { [Op.notIn]: Array.from(excludeIds) };
        prayerWhere.privacy = 'public';
      } else if (tab === 'my_requests') {
        // User's own prayer requests
        postWhere.user_id = userId;
      }
      // my_joined tab is handled via include below

      // Hidden posts: visible to original poster + repost participants
      if (tab !== 'my_requests') {
        postWhere[Op.and as unknown as string] = [
          ...(Array.isArray(postWhere[Op.and as unknown as string]) ? postWhere[Op.and as unknown as string] : []),
          sequelize.literal(
            `(\`Post\`.\`hidden\` = 0 OR \`Post\`.\`user_id\` = ${userId}` +
            ` OR \`Post\`.\`id\` IN (SELECT r.post_id FROM reposts r WHERE r.user_id = ${userId})` +
            ` OR \`Post\`.\`id\` IN (SELECT r.quote_post_id FROM reposts r INNER JOIN posts p ON r.post_id = p.id WHERE p.user_id = ${userId}))`
          ),
        ];
      }

      // Cursor pagination
      if (cursor) {
        const decoded = decodeCursor(cursor);
        if (decoded) {
          postWhere[Op.or as unknown as string] = [
            {
              created_at: { [Op.lt]: decoded.created_at },
            },
            {
              created_at: decoded.created_at,
              id: { [Op.lt]: decoded.id },
            },
          ];
        }
      }

      // Build the query
      const includeArray: Array<Record<string, unknown>> = [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'],
        },
        {
          model: PostMedia,
          as: 'media',
          attributes: ['id', 'media_type', 'url', 'thumbnail_url', 'width', 'height', 'duration', 'sort_order'],
        },
      ];

      // For my_joined tab, require PrayerSupport from the requesting user
      const prayerInclude: Array<Record<string, unknown>> = [];
      if (tab === 'my_joined') {
        prayerInclude.push({
          model: PrayerSupport,
          as: 'supports',
          where: { user_id: userId },
          attributes: [],
          required: true,
        });
      }

      // Find prayer requests through Post -> PrayerRequest join
      const posts = await Post.findAll({
        where: postWhere,
        include: [
          ...includeArray,
          {
            model: PrayerRequest,
            as: 'prayerRequest',
            where: prayerWhere,
            required: true,
            include: prayerInclude,
          },
        ],
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit: limit + 1,
        subQuery: false,
      });

      const hasMore = posts.length > limit;
      const results = hasMore ? posts.slice(0, limit) : posts;

      // Check which prayers the requesting user has prayed for
      const prayerRequestIds = results
        .map((p) => {
          const pr = (p as unknown as Record<string, unknown>).prayerRequest as Record<string, unknown> | undefined;
          return pr?.id as number | undefined;
        })
        .filter((id): id is number => id != null);

      const userSupports = prayerRequestIds.length > 0
        ? await PrayerSupport.findAll({
            where: {
              user_id: userId,
              prayer_request_id: { [Op.in]: prayerRequestIds },
            },
            attributes: ['prayer_request_id'],
            raw: true,
          })
        : [];

      const supportedIds = new Set(userSupports.map((s) => s.prayer_request_id));

      // Get comment counts for all posts in one query
      const postIds = results.map((p) => p.id);
      const commentCountRows = postIds.length > 0
        ? await PostComment.findAll({
            attributes: [
              'post_id',
              [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            ],
            where: {
              post_id: { [Op.in]: postIds },
              [Op.or as unknown as string]: [
                { hidden: false },
                { hidden: true, user_id: userId },
              ],
            },
            group: ['post_id'],
            raw: true,
          })
        : [];
      const commentCountMap = new Map(
        (commentCountRows as unknown as Array<{ post_id: number; count: string }>).map(
          (r) => [r.post_id, parseInt(r.count, 10)]
        )
      );

      // Check which posts the user has reposted
      const userReposts = postIds.length > 0
        ? await Repost.findAll({
            where: { user_id: userId, post_id: { [Op.in]: postIds } },
            attributes: ['post_id'],
            raw: true,
          })
        : [];
      const repostedSet = new Set(userReposts.map((r) => r.post_id));

      // For "others" tab with followers privacy, we need to check follow status
      // But for simplicity in the initial implementation, we only show 'public' in others tab
      // The my_requests tab shows all own prayers regardless of privacy

      // Format response
      const prayers = results.map((post) => {
        const plain = post.toJSON() as unknown as Record<string, unknown>;
        const prayerRequest = plain.prayerRequest as Record<string, unknown>;
        const prId = prayerRequest?.id as number;

        const postId = plain.id as number;

        const formatted = {
          ...prayerRequest,
          post: {
            id: postId,
            body: plain.body,
            user_id: plain.user_id,
            is_anonymous: plain.is_anonymous,
            edited: plain.edited,
            flagged: plain.flagged,
            created_at: plain.created_at,
            updated_at: plain.updated_at,
            user: plain.user,
            media: plain.media,
            comment_count: commentCountMap.get(postId) || 0,
            user_reposted: repostedSet.has(postId),
          },
          is_praying: supportedIds.has(prId),
        };

        return maskAnonymous(formatted, userId);
      });

      const nextCursor = hasMore && results.length > 0
        ? encodeCursor(results[results.length - 1])
        : null;

      return successResponse({
        prayers,
        next_cursor: nextCursor,
        has_more: hasMore,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch prayer wall');
    }
  }
);

/**
 * POST /api/prayer-requests - Create a new prayer request
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;

      // Check bible-mode restriction
      const user = await User.findByPk(userId, { attributes: ['id', 'mode'] });
      if (!user) {
        return errorResponse('User not found', 404);
      }
      if (user.mode === 'positivity') {
        return errorResponse('Prayer wall is available in Bible mode', 403);
      }

      const json = await req.json();
      const parsed = createPrayerSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { body, privacy, is_anonymous, media } = parsed.data;

      // Profanity check
      const profanityResult = checkAndFlag(body);

      // Create the post
      const post = await Post.create({
        user_id: userId,
        body,
        post_type: 'prayer_request',
        visibility: privacy,
        mode: 'bible',
        is_anonymous,
        flagged: profanityResult.flagged,
      });

      // Create post media if provided
      if (media.length > 0) {
        await PostMedia.bulkCreate(
          media.map((m, index) => ({
            post_id: post.id,
            media_type: m.media_type,
            url: m.url,
            thumbnail_url: m.thumbnail_url ?? null,
            width: m.width ?? null,
            height: m.height ?? null,
            duration: m.duration ?? null,
            sort_order: m.sort_order ?? index,
          }))
        );
      }

      // Create PrayerRequest extension row
      await PrayerRequest.create({
        post_id: post.id,
        privacy,
      });

      // Fire-and-forget: track social activity
      import('@/lib/streaks/tracker').then(({ trackActivity }) => {
        trackActivity(userId, 'social_activity').catch(() => {});
      }).catch(() => {});

      // Reload with associations
      const created = await Post.findByPk(post.id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'display_name', 'avatar_url', 'avatar_color', 'is_verified'],
          },
          {
            model: PostMedia,
            as: 'media',
            attributes: ['id', 'media_type', 'url', 'thumbnail_url', 'width', 'height', 'duration', 'sort_order'],
          },
          {
            model: PrayerRequest,
            as: 'prayerRequest',
          },
        ],
      });

      const plain = created!.toJSON() as unknown as Record<string, unknown>;
      const prayerRequest = plain.prayerRequest as Record<string, unknown>;

      const response = {
        ...prayerRequest,
        post: {
          id: plain.id,
          body: plain.body,
          user_id: plain.user_id,
          is_anonymous: plain.is_anonymous,
          edited: plain.edited,
          flagged: plain.flagged,
          created_at: plain.created_at,
          updated_at: plain.updated_at,
          user: plain.user,
          media: plain.media,
        },
        is_praying: false,
      };

      return successResponse(response, 201);
    } catch (error) {
      return serverError(error, 'Failed to create prayer request');
    }
  }
);
