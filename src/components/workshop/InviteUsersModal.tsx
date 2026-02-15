'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Loader2, Check, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { useToast } from '@/components/ui/Toast';

interface UserResult {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface InviteUsersModalProps {
  workshopId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function InviteUsersModal({
  workshopId,
  isOpen,
  onClose,
}: InviteUsersModalProps) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelected(new Set());
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('q', query);
        params.set('limit', '20');

        const res = await fetch(`/api/users/search?${params}`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          setResults(data.users ?? []);
        }
      } catch {
        // Silently fail search
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen]);

  const toggleUser = useCallback((userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleInvite = useCallback(async () => {
    if (selected.size === 0 || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/workshops/${workshopId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userIds: Array.from(selected) }),
      });

      if (res.ok) {
        const data = await res.json();
        const invited = data.data?.invited ?? data.invited ?? selected.size;
        toast.success(`Invited ${invited} user${invited !== 1 ? 's' : ''}`);
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to send invitations');
      }
    } catch {
      toast.error('Failed to send invitations');
    } finally {
      setSubmitting(false);
    }
  }, [workshopId, selected, submitting, toast, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Users" size="lg">
      {/* Search input */}
      <div className="mb-4">
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

      {/* Selected count */}
      {selected.size > 0 && (
        <div className="mb-3 text-xs font-medium text-primary">
          {selected.size} user{selected.size !== 1 ? 's' : ''} selected
        </div>
      )}

      {/* Results */}
      <div className="max-h-64 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No users found
          </div>
        )}

        {!loading && query.length < 2 && (
          <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Type at least 2 characters to search
          </div>
        )}

        {!loading &&
          results.map((user) => {
            const isSelected = selected.has(user.id);

            return (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleUser(user.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  isSelected
                    ? 'bg-primary/5 dark:bg-primary/10'
                    : 'hover:bg-gray-50 dark:hover:bg-white/5'
                )}
              >
                <div className="shrink-0">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar
                      name={user.display_name}
                      color={user.avatar_color}
                      size={40}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text dark:text-text-dark">
                    {user.display_name}
                  </div>
                  <div className="text-xs text-text-muted dark:text-text-muted-dark">
                    @{user.username}
                  </div>
                </div>
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    isSelected
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
              </button>
            );
          })}
      </div>

      {/* Invite button */}
      <div className="mt-4 border-t border-border pt-4 dark:border-border-dark">
        <Button
          variant="primary"
          fullWidth
          loading={submitting}
          disabled={selected.size === 0}
          onClick={handleInvite}
        >
          <UserPlus className="h-4 w-4" />
          Invite {selected.size > 0 ? `${selected.size} User${selected.size !== 1 ? 's' : ''}` : 'Selected'}
        </Button>
      </div>
    </Modal>
  );
}
