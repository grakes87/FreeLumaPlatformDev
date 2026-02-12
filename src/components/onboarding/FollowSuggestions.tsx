'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface SuggestedAccount {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string;
}

// Phase 1 placeholder suggestions (admin + official accounts)
const SUGGESTED_ACCOUNTS: SuggestedAccount[] = [
  {
    id: 'freeluma',
    display_name: 'Free Luma',
    username: 'freeluma',
    avatar_url: null,
    avatar_color: '#6366F1',
    bio: 'Official Free Luma account. Daily inspiration and updates.',
  },
  {
    id: 'dailyverse',
    display_name: 'Daily Verse',
    username: 'dailyverse',
    avatar_url: null,
    avatar_color: '#3B82F6',
    bio: 'Your daily Bible verse and inspiration.',
  },
  {
    id: 'positivitydaily',
    display_name: 'Positivity Daily',
    username: 'positivitydaily',
    avatar_url: null,
    avatar_color: '#F97316',
    bio: 'Spreading positivity, one quote at a time.',
  },
];

export function FollowSuggestions() {
  const router = useRouter();
  const toast = useToast();
  const { refreshUser } = useAuth();

  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleFollow = (id: string) => {
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Note: Follow persistence is deferred to Phase 2.
      // For now, we just mark onboarding as complete.
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
        {SUGGESTED_ACCOUNTS.map((account) => {
          const isFollowed = followedIds.has(account.id);

          return (
            <div
              key={account.id}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-4 transition-colors',
                'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
              )}
            >
              {/* Avatar */}
              {account.avatar_url ? (
                <img
                  src={account.avatar_url}
                  alt={account.display_name}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <InitialsAvatar
                  name={account.display_name}
                  color={account.avatar_color}
                  size={48}
                  className="shrink-0"
                />
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text dark:text-text-dark">
                  {account.display_name}
                </p>
                <p className="truncate text-sm text-text-muted dark:text-text-muted-dark">
                  @{account.username}
                </p>
              </div>

              {/* Follow button */}
              <button
                type="button"
                onClick={() => toggleFollow(account.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
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
        })}
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
