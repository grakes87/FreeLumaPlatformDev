'use client';

import { useEffect, useState } from 'react';
import { Inbox, Search } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { UserSearchResult } from '@/components/social/UserSearchResult';
import type { SearchResult } from '@/hooks/useUserSearch';

/**
 * Empty state shown when the feed has zero posts.
 * Displays a message and follow suggestions fetched from /api/follows/suggestions.
 */
export function EmptyFeedState() {
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/follows/suggestions?limit=5', {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setSuggestions(data.suggestions || []);
        }
      } catch {
        // Silently fail -- empty state still shows message
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSuggestions();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
        <Inbox className="h-8 w-8 text-primary" />
      </div>

      <h3 className="text-lg font-semibold text-text dark:text-text-dark">
        Your feed is empty
      </h3>
      <p className="mt-1.5 max-w-xs text-sm text-text-muted dark:text-text-muted-dark">
        Follow people to see their posts here!
      </p>

      {/* Follow suggestions */}
      {!loading && suggestions.length > 0 && (
        <div className="mt-8 w-full max-w-md">
          <h4 className="mb-3 text-left text-sm font-semibold text-text dark:text-text-dark">
            Suggested for you
          </h4>
          <div className="space-y-1">
            {suggestions.map((user) => (
              <UserSearchResult
                key={user.id}
                user={user}
              />
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-8 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      )}

      <Link
        href="/feed"
        className={cn(
          'mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white',
          'bg-primary hover:bg-primary/90 transition-colors'
        )}
      >
        <Search className="h-4 w-4" />
        Find Friends
      </Link>
    </div>
  );
}
