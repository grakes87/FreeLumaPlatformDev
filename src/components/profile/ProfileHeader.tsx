'use client';

import { MapPin, Link as LinkIcon, Pencil, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from './InitialsAvatar';
import { ProfileStats } from './ProfileStats';
import { FollowButton } from '@/components/social/FollowButton';
import type { FollowStatus } from '@/hooks/useFollow';

interface ProfileUser {
  id: number;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  avatar_color: string;
  location?: string | null;
  website?: string | null;
}

interface ProfileHeaderProps {
  user: ProfileUser;
  stats: {
    post_count: number;
    follower_count: number;
    following_count: number;
  };
  relationship: 'self' | 'following' | 'pending' | 'none' | 'follows_you';
  isOwnProfile: boolean;
  onEditProfile?: () => void;
  onFollowersTap?: () => void;
  onFollowingTap?: () => void;
  className?: string;
}

/**
 * Instagram-style profile header with avatar, stats, bio, and action buttons.
 */
export function ProfileHeader({
  user,
  stats,
  relationship,
  isOwnProfile,
  onEditProfile,
  onFollowersTap,
  onFollowingTap,
  className,
}: ProfileHeaderProps) {
  const followStatus: FollowStatus =
    relationship === 'following' ? 'active' :
    relationship === 'pending' ? 'pending' :
    'none';

  const websiteDisplay = user.website
    ? user.website.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : null;

  return (
    <div className={cn('px-4 py-4', className)}>
      {/* Row 1: Avatar + Stats */}
      <div className="flex items-center gap-6">
        {/* Avatar */}
        <div className="shrink-0">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.display_name}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <InitialsAvatar
              name={user.display_name}
              color={user.avatar_color}
              size={80}
            />
          )}
        </div>

        {/* Stats */}
        <ProfileStats
          postCount={stats.post_count}
          followerCount={stats.follower_count}
          followingCount={stats.following_count}
          onFollowersTap={onFollowersTap}
          onFollowingTap={onFollowingTap}
          className="flex-1"
        />
      </div>

      {/* Row 2: Display name + username */}
      <div className="mt-3">
        <h1 className="text-base font-bold text-text dark:text-text-dark">
          {user.display_name}
        </h1>
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          @{user.username}
        </p>
      </div>

      {/* Row 3: Bio */}
      {user.bio && (
        <p className="mt-2 text-sm text-text dark:text-text-dark whitespace-pre-line">
          {user.bio}
        </p>
      )}

      {/* Row 4: Location + Website */}
      {(user.location || user.website) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted dark:text-text-muted-dark">
          {user.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {user.location}
            </span>
          )}
          {user.website && websiteDisplay && (
            <a
              href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {websiteDisplay}
            </a>
          )}
        </div>
      )}

      {/* Row 5: Action buttons */}
      <div className="mt-4 flex items-center gap-2">
        {isOwnProfile ? (
          <button
            type="button"
            onClick={onEditProfile}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors',
              'hover:bg-slate-50 text-text',
              'dark:border-border-dark dark:text-text-dark dark:hover:bg-slate-800/50'
            )}
          >
            <Pencil className="h-4 w-4" />
            Edit Profile
          </button>
        ) : (
          <>
            <FollowButton
              userId={user.id}
              initialStatus={followStatus}
              size="md"
              className="flex-1 justify-center"
            />
            <button
              type="button"
              disabled
              className={cn(
                'flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors',
                'text-text-muted opacity-50 cursor-not-allowed',
                'dark:border-border-dark dark:text-text-muted-dark'
              )}
              title="Messaging coming in Phase 3"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
