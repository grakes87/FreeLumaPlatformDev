'use client';

import { cn } from '@/lib/utils/cn';

interface ProfileStatsProps {
  postCount: number;
  followerCount: number;
  followingCount: number;
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
 * Profile stats row showing Posts / Followers / Following counts.
 * Followers and Following columns are tappable (open FollowList modal).
 */
export function ProfileStats({
  postCount,
  followerCount,
  followingCount,
  onFollowersTap,
  onFollowingTap,
  className,
}: ProfileStatsProps) {
  return (
    <div className={cn('flex items-center justify-center gap-8', className)}>
      {/* Posts */}
      <div className="flex flex-col items-center">
        <span className="text-lg font-bold text-text dark:text-text-dark">
          {formatCount(postCount)}
        </span>
        <span className="text-xs text-text-muted dark:text-text-muted-dark">
          Posts
        </span>
      </div>

      {/* Followers */}
      <button
        type="button"
        onClick={onFollowersTap}
        className="flex flex-col items-center hover:opacity-70 transition-opacity"
      >
        <span className="text-lg font-bold text-text dark:text-text-dark">
          {formatCount(followerCount)}
        </span>
        <span className="text-xs text-text-muted dark:text-text-muted-dark">
          Followers
        </span>
      </button>

      {/* Following */}
      <button
        type="button"
        onClick={onFollowingTap}
        className="flex flex-col items-center hover:opacity-70 transition-opacity"
      >
        <span className="text-lg font-bold text-text dark:text-text-dark">
          {formatCount(followingCount)}
        </span>
        <span className="text-xs text-text-muted dark:text-text-muted-dark">
          Following
        </span>
      </button>
    </div>
  );
}
