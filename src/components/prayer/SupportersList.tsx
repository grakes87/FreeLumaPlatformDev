'use client';

import { useState, useCallback, useEffect } from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Supporter {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface SupportersResponse {
  supporters: Supporter[];
  has_more: boolean;
  next_cursor: string | null;
}

interface SupportersListProps {
  prayerRequestId: number;
  isAuthor: boolean;
  prayCount: number;
}

export function SupportersList({ prayerRequestId, isAuthor, prayCount }: SupportersListProps) {
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Only render for author
  if (!isAuthor || prayCount === 0) return null;

  const fetchSupporters = useCallback(async (reset = false) => {
    setLoading(true);
    const currentCursor = reset ? null : cursor;
    const params = new URLSearchParams();
    params.set('limit', '10');
    if (currentCursor) params.set('cursor', currentCursor);

    try {
      const res = await fetch(
        `/api/prayer-requests/${prayerRequestId}/supporters?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const data: SupportersResponse = await res.json();

      if (reset) {
        setSupporters(data.supporters);
      } else {
        setSupporters((prev) => [...prev, ...data.supporters]);
      }
      setCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch (err) {
      console.error('[SupportersList] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [prayerRequestId, cursor]);

  const handleExpand = () => {
    if (!expanded) {
      setExpanded(true);
      fetchSupporters(true);
    } else {
      setExpanded(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleExpand}
        className="flex items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white/70"
      >
        <Users className="h-3.5 w-3.5" />
        <span>{prayCount} {prayCount === 1 ? 'person is' : 'people are'} praying for you</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {supporters.map((s) => (
            <a
              key={s.id}
              href={`/profile/${s.username}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
            >
              {s.avatar_url ? (
                <img
                  src={s.avatar_url}
                  alt={s.display_name}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: s.avatar_color || '#6366F1' }}
                >
                  {s.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm text-white/80">{s.display_name}</span>
            </a>
          ))}

          {loading && (
            <div className="py-2 text-center text-xs text-white/40">Loading...</div>
          )}

          {!loading && hasMore && (
            <button
              type="button"
              onClick={() => fetchSupporters()}
              className="w-full py-1.5 text-center text-xs text-white/50 transition-colors hover:text-white/70"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
