'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface UserResult {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string | null;
  follow_status: string;
}

interface UserPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 20;

/**
 * Full-screen overlay for selecting users to start new conversations.
 * Shows followers by default, with search to find any user.
 * Supports infinite scroll pagination.
 */
export function UserPicker({ isOpen, onClose }: UserPickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetRef = useRef(0);

  // Fetch users (followers or search results)
  const fetchUsers = useCallback(async (searchQuery: string, offset: number, append: boolean) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const isSearch = searchQuery.length >= 2;
      const params = new URLSearchParams();
      params.set('q', searchQuery);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      if (!isSearch) {
        params.set('followers_only', 'true');
      }

      const res = await fetch(`/api/users/search?${params}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        const users = data.users ?? [];
        setHasMore(data.hasMore ?? false);
        offsetRef.current = offset + users.length;

        if (append) {
          setResults((prev) => [...prev, ...users]);
        } else {
          setResults(users);
        }
      }
    } catch (err) {
      console.error('[UserPicker] fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Reset and load followers when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setHasMore(false);
      offsetRef.current = 0;
      setTimeout(() => inputRef.current?.focus(), 100);
      // Load followers immediately
      fetchUsers('', 0, false);
    }
  }, [isOpen, fetchUsers]);

  // Debounced search on query change
  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      offsetRef.current = 0;
      fetchUsers(query, 0, false);
    }, query.length >= 2 ? 300 : 100);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen, fetchUsers]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMore || !hasMore) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 100) {
      fetchUsers(query, offsetRef.current, true);
    }
  }, [query, loadingMore, hasMore, fetchUsers]);

  const handleSelectUser = useCallback(async (userId: number) => {
    try {
      setCreating(true);

      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'direct',
          participant_ids: [userId],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const conversationId = data.id ?? data.conversation_id;
        if (conversationId) {
          onClose();
          router.push(`/chat/${conversationId}`);
        }
      } else {
        // 202 means message request sent
        if (res.status === 202) {
          onClose();
        } else {
          const errData = await res.json().catch(() => null);
          console.error('[UserPicker] create conversation error:', errData?.error);
        }
      }
    } catch (err) {
      console.error('[UserPicker] create conversation error:', err);
    } finally {
      setCreating(false);
    }
  }, [router, onClose]);

  if (!isOpen) return null;

  const isSearchMode = query.length >= 2;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          New Message
        </h2>
      </div>

      {/* Search bar */}
      <div className="border-b border-gray-200 px-4 py-2 dark:border-white/10">
        <div className="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people..."
            className={cn(
              'flex-1 bg-transparent text-sm text-gray-900 outline-none',
              'placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500'
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Section label */}
      {!loading && results.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {isSearchMode ? 'Search Results' : 'Suggested'}
          </p>
        </div>
      )}

      {/* Results */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {isSearchMode ? 'No users found' : 'No followers yet'}
          </div>
        )}

        {!loading &&
          results.map((user) => (
            <button
              key={user.id}
              type="button"
              disabled={creating}
              onClick={() => handleSelectUser(user.id)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                'hover:bg-gray-50 dark:hover:bg-white/5',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <div className="shrink-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.display_name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <InitialsAvatar
                    name={user.display_name}
                    color={user.avatar_color}
                    size={48}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {user.display_name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  @{user.username}
                </div>
              </div>
              {user.follow_status === 'active' && (
                <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                  Following
                </span>
              )}
            </button>
          ))}

        {/* Load more spinner */}
        {loadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Creating overlay */}
      {creating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="rounded-xl bg-white px-6 py-4 shadow-lg dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-200">
                Opening conversation...
              </span>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
