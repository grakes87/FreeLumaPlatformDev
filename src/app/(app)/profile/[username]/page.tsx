'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs, type ProfileTab } from '@/components/profile/ProfileTabs';
import { FollowList } from '@/components/profile/FollowList';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { encodeCursor } from '@/lib/utils/cursor';

interface ProfileData {
  user: {
    id: number;
    username: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    avatar_color: string;
    profile_privacy: 'public' | 'private';
    mode?: string;
    denomination?: string | null;
    church?: string | null;
    location?: string | null;
    website?: string | null;
    date_of_birth?: string | null;
    created_at?: string;
  };
  stats: {
    post_count: number;
    follower_count: number;
    following_count: number;
  };
  relationship: 'self' | 'following' | 'pending' | 'none' | 'follows_you';
  posts: {
    items: Array<Record<string, unknown>>;
    next_cursor: string | null;
    has_more: boolean;
  } | null;
}

/**
 * Public profile page for any user: /profile/[username]
 * Shows ProfileHeader, tabs (Posts/Reposts, + Saved if own), and tab content.
 * Private profiles show limited header + "This account is private" message.
 */
export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const username = params.username as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [tabItems, setTabItems] = useState<Array<Record<string, unknown>>>([]);
  const [tabCursor, setTabCursor] = useState<string | null>(null);
  const [tabHasMore, setTabHasMore] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);

  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);

  const isOwnProfile = !!(currentUser && profile && profile.relationship === 'self');
  const isPrivate = profile?.posts === null && profile?.user.profile_privacy === 'private';

  // Fetch profile data
  const fetchProfile = useCallback(async (tab: ProfileTab = 'posts') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile?tab=${tab}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load profile');
        }
        setLoading(false);
        return;
      }

      const data: ProfileData = await res.json();
      setProfile(data);

      if (data.posts) {
        setTabItems(data.posts.items);
        setTabCursor(data.posts.next_cursor);
        setTabHasMore(data.posts.has_more);
      } else {
        setTabItems([]);
        setTabCursor(null);
        setTabHasMore(false);
      }
    } catch {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Tab change handler
  const handleTabChange = useCallback(async (tab: ProfileTab) => {
    setActiveTab(tab);
    setTabLoading(true);
    setTabItems([]);
    setTabCursor(null);
    setTabHasMore(false);

    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(username)}/profile?tab=${tab}`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.posts) {
          setTabItems(data.posts.items);
          setTabCursor(data.posts.next_cursor);
          setTabHasMore(data.posts.has_more);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setTabLoading(false);
    }
  }, [username]);

  // Load more for infinite scroll
  const loadMore = useCallback(async () => {
    if (tabLoading || !tabHasMore || !tabCursor) return;
    setTabLoading(true);

    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(username)}/profile?tab=${activeTab}&cursor=${encodeURIComponent(tabCursor)}`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.posts) {
          setTabItems((prev) => [...prev, ...data.posts.items]);
          setTabCursor(data.posts.next_cursor);
          setTabHasMore(data.posts.has_more);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setTabLoading(false);
    }
  }, [username, activeTab, tabCursor, tabHasMore, tabLoading]);

  // Infinite scroll sentinel
  const { ref: sentinelRef } = useInfiniteScroll();

  // Trigger loadMore when sentinel is in view
  useEffect(() => {
    if (tabHasMore && !tabLoading) {
      // The sentinel observer triggers via useInfiniteScroll
    }
  }, [tabHasMore, tabLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted dark:text-text-muted-dark" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted dark:text-text-muted-dark">
        <p className="text-lg font-medium">{error || 'User not found'}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Profile Header */}
      <ProfileHeader
        user={profile.user}
        stats={profile.stats}
        relationship={profile.relationship}
        isOwnProfile={isOwnProfile}
        onEditProfile={() => router.push('/profile/edit')}
        onFollowersTap={() => setFollowListType('followers')}
        onFollowingTap={() => setFollowListType('following')}
      />

      {/* Private profile gate */}
      {isPrivate ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border dark:border-border-dark mb-4">
            <Lock className="h-8 w-8 text-text-muted dark:text-text-muted-dark" />
          </div>
          <h3 className="text-lg font-semibold text-text dark:text-text-dark">
            This Account is Private
          </h3>
          <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
            Follow this account to see their posts.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <ProfileTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            isOwnProfile={isOwnProfile}
          />

          {/* Tab content */}
          <div className="min-h-[200px]">
            {tabLoading && tabItems.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-text-muted dark:text-text-muted-dark" />
              </div>
            ) : tabItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-muted dark:text-text-muted-dark">
                <p className="text-sm">
                  {activeTab === 'posts' && 'No posts yet'}
                  {activeTab === 'reposts' && 'No reposts yet'}
                  {activeTab === 'saved' && 'No saved posts yet'}
                </p>
              </div>
            ) : (
              <div>
                {tabItems.map((item, index) => (
                  <ProfilePostItem
                    key={`${activeTab}-${(item as { id?: number }).id || index}`}
                    item={item}
                    tab={activeTab}
                  />
                ))}

                {/* Infinite scroll sentinel */}
                {tabHasMore && (
                  <div
                    ref={sentinelRef}
                    className="flex justify-center py-4"
                    onClick={loadMore}
                  >
                    {tabLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
                    ) : (
                      <button
                        type="button"
                        onClick={loadMore}
                        className="text-sm text-primary hover:underline"
                      >
                        Load more
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* FollowList modal */}
      {followListType && (
        <FollowList
          userId={profile.user.id}
          type={followListType}
          isOpen={!!followListType}
          onClose={() => setFollowListType(null)}
        />
      )}
    </div>
  );
}

/**
 * A simplified post preview for profile tab content.
 * Shows author, body preview, timestamp, and engagement counts.
 */
function ProfilePostItem({
  item,
  tab,
}: {
  item: Record<string, unknown>;
  tab: ProfileTab;
}) {
  const router = useRouter();

  // For reposts, the item has quotePost + originalPost
  // For saved, the item has a nested post
  // For posts, the item IS the post
  let post: Record<string, unknown> | null = null;
  let author: Record<string, unknown> | null = null;

  if (tab === 'saved') {
    post = (item.post as Record<string, unknown>) || null;
    author = post ? (post.user as Record<string, unknown>) || null : null;
  } else if (tab === 'reposts') {
    const quotePost = item.quotePost as Record<string, unknown> | null;
    const originalPost = item.originalPost as Record<string, unknown> | null;
    post = quotePost || originalPost || null;
    author = post ? (post.user as Record<string, unknown>) || null : null;
  } else {
    post = item;
    author = (item.user as Record<string, unknown>) || null;
  }

  if (!post) return null;

  const body = (post.body as string) || '';
  const createdAt = post.created_at
    ? new Date(post.created_at as string).toLocaleDateString()
    : '';
  const reactionCount = (post.reaction_count as number) || 0;
  const commentCount = (post.comment_count as number) || 0;
  const authorName = author ? String(author.display_name ?? '') : '';
  const authorUsername = author ? String(author.username ?? '') : '';
  const hasRepost = tab === 'reposts' && item.originalPost != null;

  return (
    <div
      className={cn(
        'border-b border-border px-4 py-3 dark:border-border-dark',
        'hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors'
      )}
      onClick={() => {
        // Navigate to post detail (future)
      }}
    >
      {/* Author info */}
      {authorName && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-text dark:text-text-dark">
            {authorName}
          </span>
          <span className="text-xs text-text-muted dark:text-text-muted-dark">
            @{authorUsername}
          </span>
          <span className="text-xs text-text-muted dark:text-text-muted-dark">
            {createdAt}
          </span>
        </div>
      )}

      {/* Repost indicator */}
      {hasRepost && (
        <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">
          Reposted
        </p>
      )}

      {/* Body */}
      <p className="text-sm text-text dark:text-text-dark line-clamp-3">
        {body}
      </p>

      {/* Engagement counts */}
      {(reactionCount > 0 || commentCount > 0) && (
        <div className="mt-1.5 flex gap-4 text-xs text-text-muted dark:text-text-muted-dark">
          {reactionCount > 0 && (
            <span>{reactionCount} reaction{reactionCount !== 1 ? 's' : ''}</span>
          )}
          {commentCount > 0 && (
            <span>{commentCount} comment{commentCount !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}
    </div>
  );
}
