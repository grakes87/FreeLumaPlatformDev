'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from './InitialsAvatar';
import { FollowButton } from '@/components/social/FollowButton';
import { useAuth } from '@/hooks/useAuth';
import type { FollowStatus } from '@/hooks/useFollow';
import Link from 'next/link';

interface FollowUser {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
  bio?: string | null;
}

interface FollowListItem {
  id: number;
  follower?: FollowUser;
  followedUser?: FollowUser;
  // The user detail can come from either association depending on type
}

interface FollowListProps {
  userId: number;
  type: 'followers' | 'following';
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal/bottom sheet showing a paginated list of followers or following.
 * Includes search filter, FollowButton per row, and cursor pagination.
 */
export function FollowList({ userId, type, isOpen, onClose }: FollowListProps) {
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState<FollowListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const fetchItems = useCallback(async (nextCursor?: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (nextCursor) params.set('cursor', nextCursor);

      const res = await fetch(`/api/users/${userId}/${type}?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) return;

      const data = await res.json();
      const key = type === 'followers' ? 'followers' : 'following';
      const newItems = data[key] || [];
      const newCursor = data.next_cursor || null;

      if (nextCursor) {
        setItems((prev) => [...prev, ...newItems]);
      } else {
        setItems(newItems);
      }
      setCursor(newCursor);
      setHasMore(!!newCursor);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      setItems([]);
      setCursor(null);
      setHasMore(false);
      setSearchQuery('');
      fetchItems();
    }
  }, [isOpen, fetchItems]);

  const loadMore = () => {
    if (!loading && hasMore && cursor) {
      fetchItems(cursor);
    }
  };

  const getUserFromItem = (item: FollowListItem): FollowUser | null => {
    if (type === 'followers') {
      return item.follower || null;
    }
    return item.followedUser || null;
  };

  // Filter items by search query
  const filteredItems = searchQuery.trim()
    ? items.filter((item) => {
        const u = getUserFromItem(item);
        if (!u) return false;
        const q = searchQuery.toLowerCase();
        return (
          u.display_name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
        );
      })
    : items;

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        ref={containerRef}
        className={cn(
          'relative z-10 flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-surface sm:max-w-md sm:rounded-2xl',
          'dark:bg-surface-dark'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
          <h2 className="text-base font-semibold text-text dark:text-text-dark">
            {type === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="border-b border-border px-4 py-2 dark:border-border-dark">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-border bg-transparent py-2 pl-9 pr-3 text-sm outline-none',
                'placeholder:text-text-muted focus:border-primary',
                'dark:border-border-dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary'
              )}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-text-muted dark:text-text-muted-dark">
              {searchQuery
                ? 'No results found'
                : type === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone yet'}
            </div>
          )}

          {filteredItems.map((item) => {
            const u = getUserFromItem(item);
            if (!u) return null;

            const isSelf = currentUser?.id === u.id;

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <Link
                  href={`/profile/${u.username}`}
                  className="shrink-0"
                >
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt={u.display_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar
                      name={u.display_name}
                      color={u.avatar_color}
                      size={40}
                    />
                  )}
                </Link>

                <Link
                  href={`/profile/${u.username}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-sm font-semibold text-text dark:text-text-dark">
                    {u.display_name}
                  </p>
                  <p className="truncate text-xs text-text-muted dark:text-text-muted-dark">
                    @{u.username}
                  </p>
                </Link>

                {!isSelf && (
                  <FollowButton
                    userId={u.id}
                    initialStatus="none"
                    size="sm"
                  />
                )}
              </div>
            );
          })}

          {/* Load more */}
          {hasMore && !searchQuery && (
            <div className="flex justify-center py-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Load more'
                )}
              </button>
            </div>
          )}

          {loading && items.length === 0 && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-text-muted dark:text-text-muted-dark" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
