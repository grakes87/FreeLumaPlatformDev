'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  UserCog,
  Palette,
  Globe,
  Bell,
  ToggleLeft,
  LogOut,
  Loader2,
  Lock,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs, type ProfileTab } from '@/components/profile/ProfileTabs';
import { FollowList } from '@/components/profile/FollowList';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

interface SettingsItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
  href?: string;
  action?: 'logout' | 'appearance';
  danger?: boolean;
}

const SETTINGS_ITEMS: SettingsItem[] = [
  {
    icon: UserCog,
    label: 'Account Management',
    sublabel: 'Email, password',
    href: '/settings',
  },
  {
    icon: Palette,
    label: 'Appearance',
    sublabel: 'Dark mode',
    action: 'appearance',
  },
  {
    icon: Globe,
    label: 'Language Preference',
    href: '/settings',
  },
  {
    icon: Bell,
    label: 'Notification Settings',
    href: '/settings',
  },
  {
    icon: ToggleLeft,
    label: 'Mode',
    sublabel: 'Faith / Positivity',
    href: '/settings',
  },
  {
    icon: LogOut,
    label: 'Log Out',
    action: 'logout',
    danger: true,
  },
];

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
  };
  relationship: 'self' | 'following' | 'pending' | 'none' | 'follows_you';
  posts: {
    items: Array<Record<string, unknown>>;
    next_cursor: string | null;
    has_more: boolean;
  } | null;
}

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Profile data state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [tabItems, setTabItems] = useState<Array<Record<string, unknown>>>([]);
  const [tabCursor, setTabCursor] = useState<string | null>(null);
  const [tabHasMore, setTabHasMore] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);

  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleSettingClick = (item: SettingsItem) => {
    if (item.action === 'logout') {
      handleLogout();
    } else if (item.action === 'appearance') {
      setShowAppearance(!showAppearance);
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg pb-8">
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
              <div>
                {tabItems.map((item, index) => (
                  <ProfilePostItem
                    key={`${activeTab}-${(item as { id?: number }).id || index}`}
                    item={item}
                    tab={activeTab}
                  />
                ))}

                {tabHasMore && (
                  <div className="flex justify-center py-4">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={tabLoading}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      {tabLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        'Load more'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Settings section */}
      <div className="mt-6 px-4">
        <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
          Settings
        </h3>
        <Card padding="sm" className="overflow-hidden !p-0">
          {SETTINGS_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === SETTINGS_ITEMS.length - 1;

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => handleSettingClick(item)}
                  disabled={item.action === 'logout' && loggingOut}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                    'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    item.danger
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-text dark:text-text-dark',
                    item.action === 'logout' &&
                      loggingOut &&
                      'pointer-events-none opacity-60'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 opacity-70" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.sublabel && (
                      <span className="ml-1 text-xs text-text-muted dark:text-text-muted-dark">
                        - {item.sublabel}
                      </span>
                    )}
                  </div>
                  {!item.danger && (
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
                  )}
                </button>

                {/* Inline appearance options */}
                {item.action === 'appearance' && showAppearance && mounted && (
                  <div className="border-t border-border bg-slate-50/50 px-4 py-2 dark:border-border-dark dark:bg-slate-800/30">
                    <div className="flex gap-2">
                      {THEME_OPTIONS.map((option) => {
                        const ThemeIcon = option.icon;
                        const isActive = theme === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setTheme(option.value);
                              // Persist to DB
                              fetch('/api/settings', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ dark_mode: option.value }),
                              }).catch(() => {});
                            }}
                            className={cn(
                              'flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs transition-colors',
                              isActive
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-700'
                            )}
                          >
                            <ThemeIcon className="h-4 w-4" />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Divider */}
                {!isLast && (
                  <div className="mx-4 border-t border-border dark:border-border-dark" />
                )}
              </div>
            );
          })}
        </Card>
      </div>

      {/* FollowList modal */}
      {followListType && profile && (
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
 * Simplified post item for profile tab content.
 */
function ProfilePostItem({
  item,
  tab,
}: {
  item: Record<string, unknown>;
  tab: ProfileTab;
}) {
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
  const hasRepost = tab === 'reposts' && 'originalPost' in item && item.originalPost != null;

  return (
    <div
      className={cn(
        'border-b border-border px-4 py-3 dark:border-border-dark',
        'hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors'
      )}
    >
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

      {hasRepost && (
        <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">
          Reposted
        </p>
      )}

      <p className="text-sm text-text dark:text-text-dark line-clamp-3">
        {body}
      </p>

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
