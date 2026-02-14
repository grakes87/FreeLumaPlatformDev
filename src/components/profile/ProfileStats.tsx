'use client';

import { cn } from '@/lib/utils/cn';

interface ProfileStatsProps {
  followingCount: number;
  followerCount: number;
  likeCount: number;
  viewCount: number;
  onFollowersTap?: () => void;
  onFollowingTap?: () => void;
  className?: string;
}

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 10_000) {
    return `${(count / 1_000).toFixed(0)}K`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return count.toString();
}

/**
 * TikTok-style stats row: Following | Followers | Likes
 * Following and Followers are tappable.
 */
export function ProfileStats({
  followingCount,
  followerCount,
  likeCount,
  viewCount,
  onFollowersTap,
  onFollowingTap,
  className,
}: ProfileStatsProps) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Following */}
      <button
        type="button"
        onClick={onFollowingTap}
        className="flex items-baseline gap-1 hover:opacity-70 transition-opacity"
      >
        <span className="text-base font-bold text-text dark:text-text-dark">
          {formatCount(followingCount)}
        </span>
        <span className="text-sm text-text-muted dark:text-text-muted-dark">
          Following
        </span>
      </button>

      <span className="text-text-muted/40 dark:text-text-muted-dark/40">|</span>

      {/* Followers */}
      <button
        type="button"
        onClick={onFollowersTap}
        className="flex items-baseline gap-1 hover:opacity-70 transition-opacity"
      >
        <span className="text-base font-bold text-text dark:text-text-dark">
          {formatCount(followerCount)}
        </span>
        <span className="text-sm text-text-muted dark:text-text-muted-dark">
          Followers
        </span>
      </button>

      <span className="text-text-muted/40 dark:text-text-muted-dark/40">|</span>

      {/* Likes */}
      <div className="flex items-baseline gap-1">
        <span className="text-base font-bold text-text dark:text-text-dark">
          {formatCount(likeCount)}
        </span>
        <span className="text-sm text-text-muted dark:text-text-muted-dark">
          Likes
        </span>
      </div>

      <span className="text-text-muted/40 dark:text-text-muted-dark/40">|</span>

      {/* Views */}
      <div className="flex items-baseline gap-1">
        <span className="text-base font-bold text-text dark:text-text-dark">
          {formatCount(viewCount)}
        </span>
        <span className="text-sm text-text-muted dark:text-text-muted-dark">
          Views
        </span>
      </div>
    </div>
  );
}
