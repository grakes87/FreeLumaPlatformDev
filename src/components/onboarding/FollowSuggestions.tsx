'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface SuggestedUser {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string | null;
}

export function FollowSuggestions() {
  const router = useRouter();
  const toast = useToast();
  const { refreshUser } = useAuth();

  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());
  const [loadingFollow, setLoadingFollow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Fetch real suggestions on mount
  useEffect(() => {
    fetch('/api/follows/suggestions', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {
        // Silently fail - empty state will show
      })
      .finally(() => setFetching(false));
  }, []);

  const toggleFollow = async (userId: number) => {
    if (loadingFollow !== null) return;
    setLoadingFollow(userId);

    const isCurrentlyFollowed = followedIds.has(userId);

    try {
      if (isCurrentlyFollowed) {
        // Unfollow
        const res = await fetch(`/api/follows/${userId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok) {
          setFollowedIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
        }
      } else {
        // Follow
        const res = await fetch(`/api/follows/${userId}`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          setFollowedIds((prev) => {
            const next = new Set(prev);
            next.add(userId);
            return next;
          });
        }
      }
    } catch {
      toast.error('Failed to update follow status');
    } finally {
      setLoadingFollow(null);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ onboarding_step: 'complete' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete onboarding');
      }

      // Refresh user so AuthContext sees onboarding_complete = true
      await refreshUser();
      router.replace('/');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to complete. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Loading skeleton
  if (fetching) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text dark:text-text-dark">
            Suggested Accounts
          </h1>
          <p className="mt-2 text-text-muted dark:text-text-muted-dark">
            Follow accounts to get inspired. You can always find more later.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex animate-pulse items-center gap-3 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="h-12 w-12 shrink-0 rounded-full bg-surface-hover dark:bg-surface-hover-dark" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-surface-hover dark:bg-surface-hover-dark" />
                <div className="h-3 w-16 rounded bg-surface-hover dark:bg-surface-hover-dark" />
              </div>
              <div className="h-8 w-20 rounded-xl bg-surface-hover dark:bg-surface-hover-dark" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Suggested Accounts
        </h1>
        <p className="mt-2 text-text-muted dark:text-text-muted-dark">
          Follow accounts to get inspired. You can always find more later.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        {suggestions.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface py-10 text-center dark:border-border-dark dark:bg-surface-dark">
            <p className="text-text-muted dark:text-text-muted-dark">
              No suggestions available right now
            </p>
          </div>
        ) : (
          suggestions.map((user) => {
            const isFollowed = followedIds.has(user.id);
            const isLoading = loadingFollow === user.id;

            return (
              <div
                key={user.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-4 transition-colors',
                  'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
                )}
              >
                {/* Avatar */}
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.display_name}
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <InitialsAvatar
                    name={user.display_name}
                    color={user.avatar_color}
                    size={48}
                    className="shrink-0"
                  />
                )}

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text dark:text-text-dark">
                    {user.display_name}
                  </p>
                  <p className="truncate text-sm text-text-muted dark:text-text-muted-dark">
                    @{user.username}
                  </p>
                </div>

                {/* Follow button */}
                <button
                  type="button"
                  onClick={() => toggleFollow(user.id)}
                  disabled={isLoading}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                    isFollowed
                      ? 'bg-primary/10 text-primary dark:bg-primary/20'
                      : 'bg-primary text-white hover:bg-primary-dark'
                  )}
                >
                  {isFollowed ? (
                    <>
                      <UserCheck className="h-4 w-4" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Follow
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex w-full flex-col gap-2">
        <Button
          onClick={handleComplete}
          loading={saving}
          fullWidth
          size="lg"
        >
          {followedIds.size > 0
            ? `Continue (${followedIds.size} following)`
            : 'Continue'}
        </Button>
        <button
          type="button"
          onClick={handleComplete}
          disabled={saving}
          className="py-2 text-sm text-text-muted transition-colors hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
