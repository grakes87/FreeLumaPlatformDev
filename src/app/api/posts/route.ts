import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Post,
  PostMedia,
  PrayerRequest,
  User,
} from '@/lib/db/models';
import { checkAndFlag } from '@/lib/moderation/profanity';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const POST_BODY_MAX = 5000;

const createPostSchema = z.object({
  body: z.string().min(1, 'Post body is required').max(POST_BODY_MAX, `Post body must be ${POST_BODY_MAX} characters or less`),
  post_type: z.enum(['text', 'prayer_request']).default('text'),
  visibility: z.enum(['public', 'followers']).optional(),
  is_anonymous: z.boolean().default(false),
  prayer_privacy: z.enum(['public', 'followers', 'private']).optional(),
  media: z.array(z.object({
    url: z.string().url(),
    media_type: z.enum(['image', 'video']),
    thumbnail_url: z.string().url().nullable().optional(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    duration: z.number().int().positive().nullable().optional(),
    sort_order: z.number().int().min(0).optional(),
  })).max(10).default([]),
});

/**
 * POST /api/posts — Create a new post
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const json = await req.json();
      const parsed = createPostSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { body, post_type, visibility: explicitVisibility, is_anonymous, prayer_privacy, media } = parsed.data;
      const userId = context.user.id;

      // Get user's mode and profile privacy for the post
      const user = await User.findByPk(userId, { attributes: ['id', 'mode', 'profile_privacy'] });
      if (!user) {
        return errorResponse('User not found', 404);
      }

      // Derive visibility: explicit > profile_privacy mapping > default public
      const visibility = explicitVisibility
        ?? (user.profile_privacy === 'private' ? 'followers' : 'public');

      // Profanity check
      const profanityResult = checkAndFlag(body);

      // Create the post
      const post = await Post.create({
        user_id: userId,
        body,
        post_type,
        visibility,
        mode: user.mode,
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

      // Create prayer request if post_type is prayer_request
      if (post_type === 'prayer_request') {
        await PrayerRequest.create({
          post_id: post.id,
          privacy: prayer_privacy ?? visibility,
        });
      }

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

      return successResponse(created, 201);
    } catch (error) {
      return serverError(error, 'Failed to create post');
    }
  }
);
