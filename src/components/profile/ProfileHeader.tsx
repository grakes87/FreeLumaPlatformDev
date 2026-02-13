'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Link as LinkIcon, Pencil, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
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
  is_verified?: boolean;
  location?: string | null;
  website?: string | null;
}

interface ProfileHeaderProps {
  user: ProfileUser;
  stats: {
    post_count: number;
    follower_count: number;
    following_count: number;
    like_count: number;
    view_count: number;
  };
  relationship: 'self' | 'following' | 'pending' | 'none' | 'follows_you';
  isOwnProfile: boolean;
  /** Whether the current user is blocked by or has blocked this user */
  isBlocked?: boolean;
  /** The target user's messaging access preference */
  messagingAccess?: 'everyone' | 'followers' | 'mutual' | 'nobody';
  onEditProfile?: () => void;
  onFollowersTap?: () => void;
  onFollowingTap?: () => void;
  className?: string;
}

/**
 * TikTok-style profile header with avatar, name, stats, bio, and action buttons.
 */
export function ProfileHeader({
  user,
  stats,
  relationship,
  isOwnProfile,
  isBlocked = false,
  messagingAccess = 'mutual',
  onEditProfile,
  onFollowersTap,
  onFollowingTap,
  className,
}: ProfileHeaderProps) {
  const router = useRouter();
  const [creatingConversation, setCreatingConversation] = useState(false);

  const followStatus: FollowStatus =
    relationship === 'following' ? 'active' :
    relationship === 'pending' ? 'pending' :
    'none';

  // Determine if messaging is allowed based on access settings
  const canMessage = (() => {
    if (isOwnProfile || isBlocked) return false;
    if (messagingAccess === 'nobody') return false;
    if (messagingAccess === 'everyone') return true;
    if (messagingAccess === 'followers') {
      // Target allows followers; current user must be following them
      return relationship === 'following';
    }
    if (messagingAccess === 'mutual') {
      // Both must follow each other
      return relationship === 'following';
      // Note: we only know "I follow them" from relationship; mutual detection
      // is approximate here. The server will enforce the full check.
    }
    return false;
  })();

  const messageDisabledReason =
    messagingAccess === 'nobody'
      ? "This user doesn't accept messages"
      : !canMessage
        ? 'Follow this user to send a message'
        : undefined;

  const handleMessageTap = useCallback(async () => {
    if (!canMessage || creatingConversation) return;
    setCreatingConversation(true);

    try {
      // Try to create or find existing conversation
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'direct',
          participant_ids: [user.id],
        }),
      });

      if (res.ok || res.status === 200) {
        const data = await res.json();
        router.push(`/chat/${data.id || data.conversation?.id}`);
      } else if (res.status === 202) {
        // Message request created
        const data = await res.json();
        if (data.conversation?.id) {
          router.push(`/chat/${data.conversation.id}`);
        } else {
          router.push('/chat');
        }
      } else {
        // Silently fail - user can try again
      }
    } catch {
      // Silently fail
    } finally {
      setCreatingConversation(false);
    }
  }, [canMessage, creatingConversation, user.id, router]);

  const websiteDisplay = user.website
    ? user.website.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : null;

  return (
    <div className={cn('px-4 py-4', className)}>
      {/* Row 1: Avatar + Name/Username */}
      <div className="flex items-center gap-4">
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

        {/* Name + Username */}
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1 text-lg font-bold text-text dark:text-text-dark">
            <span className="truncate">{user.display_name}</span>
            {user.is_verified && <VerifiedBadge className="h-5 w-5 shrink-0 text-blue-500" />}
          </h1>
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            @{user.username}
          </p>
        </div>
      </div>

      {/* Row 2: Stats — Following | Followers | Likes */}
      <ProfileStats
        followingCount={stats.following_count}
        followerCount={stats.follower_count}
        likeCount={stats.like_count}
        viewCount={stats.view_count}
        onFollowersTap={onFollowersTap}
        onFollowingTap={onFollowingTap}
        className="mt-3"
      />

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
            {!isBlocked && (
              <button
                type="button"
                disabled={!canMessage || creatingConversation}
                onClick={handleMessageTap}
                className={cn(
                  'flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors',
                  canMessage && !creatingConversation
                    ? 'text-primary hover:bg-primary/5 dark:text-primary dark:hover:bg-primary/10'
                    : 'text-text-muted opacity-50 cursor-not-allowed',
                  'dark:border-border-dark'
                )}
                title={messageDisabledReason}
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
