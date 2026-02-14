'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Camera, X, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface FollowerResult {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface GroupCreateFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_MEMBERS = 256;
const MAX_NAME_LENGTH = 100;

/**
 * Single-page group creation: optional photo + name at top,
 * member search/selection below. If no name is given,
 * the group name defaults to comma-separated member names.
 */
export function GroupCreateFlow({ isOpen, onClose }: GroupCreateFlowProps) {
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [groupPhotoUrl, setGroupPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<FollowerResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FollowerResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetRef = useRef(0);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setGroupName('');
      setGroupPhotoUrl(null);
      setSelectedMembers([]);
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      offsetRef.current = 0;
      // Load followers immediately
      fetchFollowers('', 0, false);
      setTimeout(() => searchInputRef.current?.focus(), 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Fetch followers with pagination
  const fetchFollowers = useCallback(async (q: string, offset: number, append: boolean) => {
    if (offset === 0) {
      setLoadingSearch(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const params = new URLSearchParams({
        q,
        followers_only: 'true',
        limit: '20',
        offset: String(offset),
      });
      const res = await fetch(`/api/users/search?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const users = data.users ?? [];
        setHasMore(data.hasMore ?? false);
        offsetRef.current = offset + users.length;
        if (append) {
          setSearchResults((prev) => [...prev, ...users]);
        } else {
          setSearchResults(users);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoadingSearch(false);
      setLoadingMore(false);
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      offsetRef.current = 0;
      fetchFollowers(searchQuery, 0, false);
    }, searchQuery.length >= 2 ? 300 : 100);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, isOpen, fetchFollowers]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      fetchFollowers(searchQuery, offsetRef.current, true);
    }
  }, [searchQuery, loadingMore, hasMore, fetchFollowers]);

  // Handle photo upload
  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/chat-media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setGroupPhotoUrl(data.public_url);
      }
    } catch (err) {
      console.error('[GroupCreateFlow] photo upload error:', err);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  // Toggle member selection
  const toggleMember = useCallback((user: FollowerResult) => {
    setSelectedMembers((prev) => {
      const exists = prev.find((m) => m.id === user.id);
      if (exists) return prev.filter((m) => m.id !== user.id);
      if (prev.length >= MAX_MEMBERS - 1) return prev;
      return [...prev, user];
    });
  }, []);

  // Remove member chip
  const removeMember = useCallback((userId: number) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
  }, []);

  // Create group — use comma-separated names if no name provided
  const handleCreate = useCallback(async () => {
    if (selectedMembers.length === 0) return;

    const finalName = groupName.trim()
      || selectedMembers.map((m) => m.display_name).join(', ');

    try {
      setCreating(true);
      setError(null);

      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'group',
          name: finalName,
          participant_ids: selectedMembers.map((m) => m.id),
          avatar_url: groupPhotoUrl,
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
        setError(errData?.error || 'Failed to create group');
      }
    } catch {
      setError('Failed to create group');
    } finally {
      setCreating(false);
    }
  }, [groupName, selectedMembers, groupPhotoUrl, router, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 dark:border-white/10 px-4">
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
        <h2 className="flex-1 text-lg font-semibold text-gray-900 dark:text-white">
          New Group
        </h2>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || selectedMembers.length === 0}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            selectedMembers.length > 0 && !creating
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
          )}
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            `Create (${selectedMembers.length})`
          )}
        </button>
      </div>

      {/* Group info row: photo + name */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPhoto}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {groupPhotoUrl ? (
            <img
              src={groupPhotoUrl}
              alt="Group photo"
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : uploadingPhoto ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : (
            <Camera className="h-5 w-5 text-gray-400" />
          )}
          {!uploadingPhoto && !groupPhotoUrl && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow">
              <Camera className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          className="hidden"
        />
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value.slice(0, MAX_NAME_LENGTH))}
          placeholder="Group name (optional)"
          maxLength={MAX_NAME_LENGTH}
          className={cn(
            'flex-1 rounded-xl border border-gray-200 dark:border-gray-700',
            'bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm',
            'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-primary/50'
          )}
        />
      </div>

      {/* Selected members chips */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-white/10 px-4 py-2">
          {selectedMembers.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 pl-1 pr-2 py-0.5"
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <InitialsAvatar name={m.display_name} color={m.avatar_color} size={20} className="text-[8px]" />
              )}
              <span className="text-xs font-medium text-primary">{m.display_name}</span>
              <button
                type="button"
                onClick={() => removeMember(m.id)}
                className="ml-0.5 text-primary/60 hover:text-primary"
                aria-label={`Remove ${m.display_name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="self-center text-xs text-gray-400">
            {selectedMembers.length}/{MAX_MEMBERS - 1}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="border-b border-gray-200 dark:border-white/10 px-4 py-2">
        <div className="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Section label */}
      {!loadingSearch && searchResults.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {searchQuery.length >= 2 ? 'Search Results' : 'Suggested'}
          </p>
        </div>
      )}

      {/* Results */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {loadingSearch && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loadingSearch && searchResults.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {searchQuery.length >= 2 ? 'No users found' : 'No followers yet'}
          </div>
        )}

        {!loadingSearch &&
          searchResults.map((user) => {
            const isSelected = selectedMembers.some((m) => m.id === user.id);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleMember(user)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                  'hover:bg-gray-50 dark:hover:bg-white/5'
                )}
              >
                <div className="shrink-0">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar
                      name={user.display_name}
                      color={user.avatar_color}
                      size={44}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {user.display_name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    @{user.username}
                  </div>
                </div>
                {/* Checkbox */}
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-gray-300 dark:border-gray-600'
                  )}
                >
                  {isSelected && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}

        {/* Load more spinner */}
        {loadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border-t border-gray-200 dark:border-white/10 px-4 py-2 text-center text-sm text-red-500">
          {error}
        </div>
      )}
    </div>,
    document.body
  );
}
