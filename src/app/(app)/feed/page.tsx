'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useFeed } from '@/hooks/useFeed';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { useUserSearch } from '@/hooks/useUserSearch';
import { useAuth } from '@/hooks/useAuth';
import { FeedTabs } from '@/components/feed/FeedTabs';
import { PostFeed } from '@/components/feed/PostFeed';
import { UserSearchResult } from '@/components/social/UserSearchResult';

/**
 * Feed page with FYP/Following tab toggle, user search bar, and PostFeed component.
 * Uses usePlatformSettings for feed style (tiktok vs instagram).
 */
export default function FeedPage() {
  const { user } = useAuth();
  const { feedStyle, loading: settingsLoading } = usePlatformSettings();
  const {
    posts,
    loading,
    refreshing,
    hasMore,
    activeTab,
    fetchNextPage,
    refresh,
    setActiveTab,
    removePost,
    updatePost,
  } = useFeed();

  const {
    query,
    setQuery,
    results: searchResults,
    loading: searchLoading,
  } = useUserSearch();

  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showSearchResults =
    searchFocused && query.trim().length >= 2;

  const isTikTok = feedStyle === 'tiktok';

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setSearchFocused(false);
    inputRef.current?.blur();
  }, [setQuery]);

  // Show loading while settings load (to avoid layout shift between modes)
  if (settingsLoading) {
    return (
      <div className="flex min-h-[calc(100vh-7.5rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className={cn(isTikTok && 'bg-black')}>
      {/* Search bar -- hidden in TikTok mode for immersive experience */}
      {!isTikTok && (
        <div ref={searchRef} className="relative z-30 border-b border-border bg-surface px-4 py-2 dark:border-border-dark dark:bg-surface-dark">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search people..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              className={cn(
                'w-full rounded-xl border border-border bg-white py-2 pl-9 pr-8 text-sm text-text placeholder:text-text-muted',
                'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50',
                'dark:border-border-dark dark:bg-slate-900 dark:text-text-dark dark:placeholder:text-text-muted-dark'
              )}
            />
            {query && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {showSearchResults && (
            <div
              className={cn(
                'absolute inset-x-0 top-full z-40 mx-4 mt-1 max-h-80 overflow-y-auto rounded-xl border shadow-lg',
                'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
              )}
            >
              {searchLoading && (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                </div>
              )}

              {!searchLoading && searchResults.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-text-muted dark:text-text-muted-dark">
                  No users found
                </p>
              )}

              {!searchLoading &&
                searchResults.map((u) => (
                  <UserSearchResult
                    key={u.id}
                    user={u}
                    hideFollow={u.id === user?.id}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Feed tabs */}
      <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Post feed */}
      <PostFeed
        posts={posts}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={fetchNextPage}
        feedStyle={feedStyle}
        refreshing={refreshing}
        onRefresh={refresh}
        currentUserId={user?.id ?? null}
        onRemovePost={removePost}
        onUpdatePost={updatePost}
      />
    </div>
  );
}
