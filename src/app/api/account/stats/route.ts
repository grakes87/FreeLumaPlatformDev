import { NextRequest } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  User,
  Post,
  Follow,
  PostReaction,
  PostComment,
  PrayerSupport,
  VideoReaction,
} from '@/lib/db/models';
import { calculateStreak } from '@/lib/streaks/calculator';
import { successResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/account/stats
 *
 * Returns comprehensive account statistics including:
 * - Account info (join date, email, content mode)
 * - Activity counts (posts, comments, reactions, prayers, followers/following)
 * - Streak data (current streak, longest streak, total active days)
 */
export const GET = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const userId = context.user.id;

      // Fetch user basic info
      const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'mode', 'timezone', 'created_at'],
      });

      if (!user) {
        return serverError(new Error('User not found'), 'User not found');
      }

      // Run all count queries in parallel for performance
      const [
        totalPosts,
        followersCount,
        followingCount,
        totalReactionsGiven,
        totalVideoReactionsGiven,
        totalComments,
        totalPrayers,
        streakData,
      ] = await Promise.all([
        Post.count({ where: { user_id: userId } }),
        Follow.count({ where: { following_id: userId, status: 'accepted' } }),
        Follow.count({ where: { follower_id: userId, status: 'accepted' } }),
        PostReaction.count({ where: { user_id: userId } }),
        VideoReaction.count({ where: { user_id: userId } }),
        PostComment.count({ where: { user_id: userId } }),
        PrayerSupport.count({ where: { user_id: userId } }),
        calculateStreak(userId, user.timezone || 'UTC'),
      ]);

      return successResponse({
        account: {
          join_date: user.created_at,
          email: user.email,
          content_mode: user.mode,
        },
        activity: {
          total_posts: totalPosts,
          total_comments: totalComments,
          total_reactions_given: totalReactionsGiven + totalVideoReactionsGiven,
          total_prayers: totalPrayers,
          followers_count: followersCount,
          following_count: followingCount,
        },
        streak: streakData,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch account stats');
    }
  }
);
