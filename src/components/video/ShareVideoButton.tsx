'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface UserResult {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
  follow_status: string;
}

interface ShareVideoButtonProps {
  videoId: number;
  videoTitle: string;
}

const PAGE_SIZE = 20;

/**
 * Share video to a DM conversation.
 * Opens a user picker overlay, creates/finds a conversation, then sends a shared_video message.
 */
export function ShareVideoButton({ videoId, videoTitle }: ShareVideoButtonProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all active:scale-95',
          'bg-gray-100 text-gray-600 hover:bg-gray-200',
          'dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15'
        )}
      >
        <Send className="h-4 w-4" />
        <span className="text-xs font-medium">Share</span>
      </button>

      {pickerOpen && (
        <SharePicker
          videoId={videoId}
          videoTitle={videoTitle}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

// ---- Share Picker Overlay ----

interface SharePickerProps {
  videoId: number;
  videoTitle: string;
  onClose: () => void;
}

function SharePicker({ videoId, videoTitle, onClose }: SharePickerProps) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetRef = useRef(0);

  // Fetch users (followers or search)
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
      console.error('[SharePicker] fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load followers on open
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
    fetchUsers('', 0, false);
  }, [fetchUsers]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      offsetRef.current = 0;
      fetchUsers(query, 0, false);
    }, query.length >= 2 ? 300 : 100);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchUsers]);

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
      setSending(true);

      // Step 1: Create or find existing conversation
      const convRes = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'direct',
          participant_ids: [userId],
        }),
      });

      if (!convRes.ok && convRes.status !== 202) {
        throw new Error('Failed to create conversation');
      }

      const convData = await convRes.json();
      const conversationId = convData.id ?? convData.conversation_id;

      if (!conversationId) {
        throw new Error('No conversation ID returned');
      }

      // Step 2: Send shared_video message
      const msgRes = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'shared_video',
          shared_video_id: videoId,
          content: videoTitle,
        }),
      });

      if (!msgRes.ok) {
        throw new Error('Failed to send video');
      }

      toast.success('Video shared to chat');
      onClose();
    } catch (err) {
      console.error('[SharePicker] share error:', err);
      toast.error('Failed to share video');
    } finally {
      setSending(false);
    }
  }, [videoId, videoTitle, onClose, toast]);

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
          Share Video
        </h2>
      </div>

      {/* Search bar */}
      <div className="border-b border-gray-200 px-4 py-2 dark:border-white/10">
        <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-800">
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
        <div className="px-4 pb-1 pt-3">
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
              disabled={sending}
              onClick={() => handleSelectUser(user.id)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                'hover:bg-gray-50 dark:hover:bg-white/5',
                'disabled:cursor-not-allowed disabled:opacity-50'
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
              <Send className="h-4 w-4 shrink-0 text-gray-400" />
            </button>
          ))}

        {/* Load more spinner */}
        {loadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Sending overlay */}
      {sending && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="rounded-xl bg-white px-6 py-4 shadow-lg dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-200">
                Sharing video...
              </span>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
