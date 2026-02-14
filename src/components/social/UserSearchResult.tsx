'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { FollowButton } from './FollowButton';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import type { FollowStatus } from '@/hooks/useFollow';

interface UserSearchResultProps {
  user: {
    id: number;
    display_name: string;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
    bio: string | null;
    is_verified?: boolean;
    follow_status: FollowStatus;
  };
  /** Hide follow button (e.g., on own profile) */
  hideFollow?: boolean;
  className?: string;
}

/**
 * User search result row: avatar + name + @username + bio + FollowButton.
 * Entire row is clickable to navigate to the user's profile.
 */
export function UserSearchResult({
  user,
  hideFollow = false,
  className,
}: UserSearchResultProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl p-3 transition-colors',
        'hover:bg-slate-50 dark:hover:bg-slate-800/50',
        className
      )}
    >
      {/* Clickable avatar + info area */}
      <Link
        href={`/profile/${user.username}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        {/* Avatar */}
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.display_name}
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <InitialsAvatar
            name={user.display_name}
            color={user.avatar_color}
            size={44}
            className="shrink-0"
          />
        )}

        {/* User info */}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-semibold text-text dark:text-text-dark">
            <span className="truncate">{user.display_name}</span>
            {user.is_verified && <VerifiedBadge />}
          </p>
          <p className="truncate text-xs text-text-muted dark:text-text-muted-dark">
            @{user.username}
          </p>
          {user.bio && (
            <p className="mt-0.5 line-clamp-1 text-xs text-text-muted dark:text-text-muted-dark">
              {user.bio}
            </p>
          )}
        </div>
      </Link>

      {/* Follow button */}
      {!hideFollow && (
        <FollowButton
          userId={user.id}
          initialStatus={user.follow_status}
          size="sm"
        />
      )}
    </div>
  );
}
