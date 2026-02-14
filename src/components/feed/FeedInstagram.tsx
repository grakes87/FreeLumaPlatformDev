'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useFeed } from '@/hooks/useFeed';
import { useUserSearch } from '@/hooks/useUserSearch';
import { useAuth } from '@/hooks/useAuth';
import { FeedMuteProvider } from '@/context/FeedMuteContext';
import { FeedTabs } from '@/components/feed/FeedTabs';
import { PostFeed } from '@/components/feed/PostFeed';
import { PostComposer } from '@/components/feed/PostComposer';
import { UserSearchResult } from '@/components/social/UserSearchResult';

export function FeedInstagram() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('compose') === 'post') {
      setComposerOpen(true);
      router.replace('/feed', { scroll: false });
    }
  }, [searchParams, router]);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showSearchResults = searchFocused && query.trim().length >= 2;

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setSearchFocused(false);
    inputRef.current?.blur();
  }, [setQuery]);

  return (
    <FeedMuteProvider>
      <div>
        {/* Search bar */}
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

        {/* Feed tabs */}
        <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} overlay={false} />

        {/* Post feed */}
        <PostFeed
          posts={posts}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={fetchNextPage}
          feedStyle="instagram"
          refreshing={refreshing}
          onRefresh={refresh}
          currentUserId={user?.id ?? null}
          onRemovePost={removePost}
          onUpdatePost={updatePost}
        />

        {/* Post composer */}
        <PostComposer
          isOpen={composerOpen}
          onClose={() => setComposerOpen(false)}
          onPostCreated={() => {
            setComposerOpen(false);
            refresh();
          }}
        />
      </div>
    </FeedMuteProvider>
  );
}
