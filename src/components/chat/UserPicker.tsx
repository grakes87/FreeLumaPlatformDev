'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
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

/**
 * Full-screen overlay for selecting users to start new conversations.
 * Searches users via /api/users/search and creates/navigates to conversations.
 */
export function UserPicker({ isOpen, onClose }: UserPickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          setResults(data.users ?? []);
        }
      } catch (err) {
        console.error('[UserPicker] search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

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
        const errData = await res.json().catch(() => null);
        // 202 means message request sent
        if (res.status === 202) {
          onClose();
          // Optionally show a toast that request was sent
        } else {
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          New Message
        </h2>
      </div>

      {/* Search bar */}
      <div className="border-b border-gray-200 px-4 py-2 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            To:
          </span>
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
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No users found
          </div>
        )}

        {!loading && query.length < 2 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Search for people to message
          </div>
        )}

        {results.map((user) => (
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
      </div>

      {/* Creating overlay */}
      {creating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="rounded-xl bg-white px-6 py-4 shadow-lg dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
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
