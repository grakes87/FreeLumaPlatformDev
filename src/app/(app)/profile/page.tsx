'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Settings, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs, type ProfileTab } from '@/components/profile/ProfileTabs';
import { ProfileGridItem } from '@/components/profile/ProfileGridItem';
import { ProfilePostViewer } from '@/components/profile/ProfilePostViewer';
import { FollowList } from '@/components/profile/FollowList';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

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
    location?: string | null;
    website?: string | null;
    created_at?: string;
  };
  stats: {
    post_count: number;
    follower_count: number;
    following_count: number;
    like_count: number;
    view_count: number;
  };
  relationship: 'self' | 'following' | 'pending' | 'none' | 'follows_you';
  posts: {
    items: Array<Record<string, unknown>>;
    next_cursor: string | null;
    has_more: boolean;
  } | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Profile data state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const initialTab = (searchParams.get('tab') as ProfileTab) || 'posts';
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [tabItems, setTabItems] = useState<Array<Record<string, unknown>>>([]);
  const [tabCursor, setTabCursor] = useState<string | null>(null);
  const [tabHasMore, setTabHasMore] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);

  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const { ref: sentinelRef, inView } = useInfiniteScroll();

  // Fetch own profile data
  const fetchProfile = useCallback(async (tab: ProfileTab = 'posts') => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(user.username)}/profile?tab=${tab}`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data: ProfileData = await res.json();
        setProfile(data);
        if (data.posts) {
          setTabItems(data.posts.items);
          setTabCursor(data.posts.next_cursor);
          setTabHasMore(data.posts.has_more);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  // Tab change handler
  const handleTabChange = useCallback(async (tab: ProfileTab) => {
    if (!user) return;
    setActiveTab(tab);
    // Persist tab in URL for back-navigation
    const url = tab === 'posts' ? '/profile' : `/profile?tab=${tab}`;
    router.replace(url, { scroll: false });
    setTabLoading(true);
    setTabItems([]);
    setTabCursor(null);
    setTabHasMore(false);

    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(user.username)}/profile?tab=${tab}`,
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
  }, [user]);

  // Load more for pagination
  const loadMore = useCallback(async () => {
    if (!user || tabLoading || !tabHasMore || !tabCursor) return;
    setTabLoading(true);

    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(user.username)}/profile?tab=${activeTab}&cursor=${encodeURIComponent(tabCursor)}`,
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
  }, [user, activeTab, tabCursor, tabHasMore, tabLoading]);

  // Trigger loadMore when sentinel scrolls into view
  useEffect(() => {
    if (inView && tabHasMore && !tabLoading) {
      loadMore();
    }
  }, [inView, tabHasMore, tabLoading, loadMore]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg pb-8">
      {/* Settings gear — top right */}
      <div className="flex justify-end px-4 pt-2">
        <Link
          href="/settings"
          className="rounded-full p-2 text-text-muted transition-colors hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800"
          aria-label="Settings"
        >
          <Settings className="h-6 w-6" />
        </Link>
      </div>

      {/* Profile Header */}
      {profileLoading && !profile ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted dark:text-text-muted-dark" />
        </div>
      ) : profile ? (
        <>
          <ProfileHeader
            user={profile.user}
            stats={profile.stats}
            relationship="self"
            isOwnProfile={true}
            onEditProfile={() => router.push('/profile/edit')}
            onFollowersTap={() => setFollowListType('followers')}
            onFollowingTap={() => setFollowListType('following')}
          />

          {/* Tabs */}
          <ProfileTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            isOwnProfile={true}
          />

          {/* Tab content */}
          <div className="min-h-[120px]">
            {tabLoading && tabItems.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-text-muted dark:text-text-muted-dark" />
              </div>
            ) : tabItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-text-muted dark:text-text-muted-dark">
                <p className="text-sm">
                  {activeTab === 'posts' && 'No posts yet'}
                  {activeTab === 'reposts' && 'No reposts yet'}
                  {activeTab === 'saved' && 'No saved posts yet'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-0.5">
                  {tabItems.map((item, index) => (
                    <ProfileGridItem
                      key={`${activeTab}-${(item as { id?: number }).id || index}`}
                      item={item}
                      tab={activeTab}
                      onClick={() => setViewerIndex(index)}
                    />
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
                {tabHasMore && (
                  <div ref={sentinelRef} className="flex justify-center py-4">
                    {tabLoading && (
                      <Loader2 className="h-5 w-5 animate-spin text-text-muted dark:text-text-muted-dark" />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : null}

      {/* FollowList modal */}
      {followListType && profile && (
        <FollowList
          userId={profile.user.id}
          type={followListType}
          isOpen={!!followListType}
          onClose={() => setFollowListType(null)}
        />
      )}

      {/* TikTok-style post viewer */}
      {viewerIndex !== null && (
        <ProfilePostViewer
          items={tabItems}
          tab={activeTab}
          startIndex={viewerIndex}
          currentUserId={user?.id ?? null}
          hasMore={tabHasMore}
          onLoadMore={loadMore}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}

