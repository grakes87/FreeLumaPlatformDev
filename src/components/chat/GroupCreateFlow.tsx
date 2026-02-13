'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Camera, X, Loader2, Search } from 'lucide-react';
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
 * Multi-step group creation flow:
 * Step 1: Group name + optional photo
 * Step 2: Select members from followers
 */
export function GroupCreateFlow({ isOpen, onClose }: GroupCreateFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [groupName, setGroupName] = useState('');
  const [groupPhotoUrl, setGroupPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<FollowerResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FollowerResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setGroupName('');
      setGroupPhotoUrl(null);
      setSelectedMembers([]);
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
    }
  }, [isOpen]);

  // Focus search when entering step 2
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [step]);

  // Search followers with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchQuery.length < 2) {
      setSearchResults([]);
      // Load default followers when no search query
      if (step === 2) {
        debounceRef.current = setTimeout(async () => {
          try {
            setLoadingSearch(true);
            const res = await fetch('/api/users/search?q=&followers_only=true&limit=50', {
              credentials: 'include',
            });
            if (res.ok) {
              const data = await res.json();
              setSearchResults(data.users ?? []);
            }
          } catch {
            // Ignore
          } finally {
            setLoadingSearch(false);
          }
        }, 100);
      }
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setLoadingSearch(true);
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery)}&followers_only=true`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users ?? []);
        }
      } catch {
        // Ignore
      } finally {
        setLoadingSearch(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, step]);

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
      if (prev.length >= MAX_MEMBERS - 1) return prev; // -1 for the creator
      return [...prev, user];
    });
  }, []);

  // Remove member chip
  const removeMember = useCallback((userId: number) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
  }, []);

  // Create group
  const handleCreate = useCallback(async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;

    try {
      setCreating(true);
      setError(null);

      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'group',
          name: groupName.trim(),
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
          onClick={step === 1 ? onClose : () => setStep(1)}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          aria-label={step === 1 ? 'Close' : 'Back'}
        >
          {step === 1 ? (
            <X className="h-6 w-6" />
          ) : (
            <ArrowLeft className="h-6 w-6" />
          )}
        </button>
        <h2 className="flex-1 text-lg font-semibold text-gray-900 dark:text-white">
          {step === 1 ? 'New Group' : 'Add Members'}
        </h2>
        {step === 1 ? (
          <button
            type="button"
            onClick={() => {
              if (groupName.trim()) setStep(2);
            }}
            disabled={!groupName.trim()}
            className={cn(
              'flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              groupName.trim()
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
            )}
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
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
        )}
      </div>

      {/* Step 1: Name + Photo */}
      {step === 1 && (
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {/* Photo */}
          <div className="mb-6 flex justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {groupPhotoUrl ? (
                <img
                  src={groupPhotoUrl}
                  alt="Group photo"
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : uploadingPhoto ? (
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              ) : (
                <Camera className="h-8 w-8 text-gray-400" />
              )}
              {!uploadingPhoto && (
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow">
                  <Camera className="h-3.5 w-3.5" />
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
          </div>

          {/* Name input */}
          <div>
            <label
              htmlFor="group-name"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Group name
            </label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value.slice(0, MAX_NAME_LENGTH))}
              placeholder="Enter group name..."
              maxLength={MAX_NAME_LENGTH}
              className={cn(
                'w-full rounded-xl border border-gray-200 dark:border-gray-700',
                'bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm',
                'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
              autoFocus
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {groupName.length}/{MAX_NAME_LENGTH}
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Select Members */}
      {step === 2 && (
        <div className="flex flex-1 flex-col min-h-0">
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
                placeholder="Search followers..."
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

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {loadingSearch && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            )}

            {!loadingSearch && searchResults.length === 0 && searchQuery.length >= 2 && (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No followers found
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
          </div>

          {/* Error */}
          {error && (
            <div className="border-t border-gray-200 dark:border-white/10 px-4 py-2 text-center text-sm text-red-500">
              {error}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
