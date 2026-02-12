'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  BookmarkX,
  Loader2,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

// ---- Types ----

interface BookmarkAuthor {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface BookmarkMedia {
  id: number;
  url: string;
  media_type: 'image' | 'video';
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
}

interface BookmarkPost {
  id: number;
  user_id: number;
  body: string;
  post_type: string;
  visibility: string;
  mode: string;
  created_at: string;
  user: BookmarkAuthor;
  media: BookmarkMedia[];
}

interface BookmarkDailyContent {
  id: number;
  post_date: string;
  mode: string;
  title: string;
  content_text: string;
  verse_reference: string | null;
  video_background_url: string | null;
}

interface BookmarkItem {
  id: number;
  user_id: number;
  post_id: number | null;
  daily_content_id: number | null;
  created_at: string;
  post: BookmarkPost | null;
  dailyContent: BookmarkDailyContent | null;
}

type FilterTab = 'all' | 'post' | 'daily';

// ---- Helpers ----

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function Avatar({ user }: { user: BookmarkAuthor }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  const initials = user.display_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
      style={{ backgroundColor: user.avatar_color }}
    >
      {initials}
    </div>
  );
}

// ---- Bookmark card ----

function BookmarkCard({
  bookmark,
  onUnbookmark,
}: {
  bookmark: BookmarkItem;
  onUnbookmark: (id: number) => void;
}) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  const handleUnbookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoving(true);

    try {
      const body: Record<string, number> = {};
      if (bookmark.post_id) body.post_id = bookmark.post_id;
      if (bookmark.daily_content_id) body.daily_content_id = bookmark.daily_content_id;

      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onUnbookmark(bookmark.id);
      }
    } catch {
      // Ignore error
    } finally {
      setRemoving(false);
    }
  };

  // Post bookmark
  if (bookmark.post && bookmark.post_id) {
    const post = bookmark.post;
    return (
      <div
        className="cursor-pointer rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md dark:border-border-dark dark:bg-surface-dark"
        onClick={() => router.push(`/post/${bookmark.post_id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') router.push(`/post/${bookmark.post_id}`);
        }}
      >
        <div className="flex items-start gap-3">
          <Avatar user={post.user} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-text dark:text-text-dark">
                  {post.user.display_name}
                </span>
                <span className="ml-2 text-sm text-text-muted dark:text-text-muted-dark">
                  @{post.user.username}
                </span>
              </div>
              <button
                type="button"
                onClick={handleUnbookmark}
                disabled={removing}
                className="flex-shrink-0 rounded-full p-1.5 text-amber-500 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30"
                aria-label="Remove bookmark"
              >
                <Bookmark className="h-4 w-4 fill-current" />
              </button>
            </div>
            <p className="mt-1 line-clamp-3 text-sm text-text dark:text-text-dark">
              {post.body}
            </p>
            {post.media.length > 0 && (
              <div className="mt-2 flex gap-1">
                {post.media.slice(0, 3).map((m) => (
                  <img
                    key={m.id}
                    src={m.url}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ))}
                {post.media.length > 3 && (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-sm text-text-muted dark:bg-slate-800 dark:text-text-muted-dark">
                    +{post.media.length - 3}
                  </div>
                )}
              </div>
            )}
            <div className="mt-2 text-xs text-text-muted dark:text-text-muted-dark">
              Saved {relativeTime(bookmark.created_at)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Daily content bookmark
  if (bookmark.dailyContent && bookmark.daily_content_id) {
    const daily = bookmark.dailyContent;
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold text-text dark:text-text-dark">
              Daily {daily.mode === 'bible' ? 'Verse' : 'Quote'}
            </span>
            <span className="text-sm text-text-muted dark:text-text-muted-dark">
              {daily.post_date}
            </span>
          </div>
          <button
            type="button"
            onClick={handleUnbookmark}
            disabled={removing}
            className="flex-shrink-0 rounded-full p-1.5 text-amber-500 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30"
            aria-label="Remove bookmark"
          >
            <Bookmark className="h-4 w-4 fill-current" />
          </button>
        </div>
        {daily.title && (
          <h3 className="mt-2 font-medium text-text dark:text-text-dark">
            {daily.title}
          </h3>
        )}
        <p className="mt-1 line-clamp-3 text-sm text-text dark:text-text-dark">
          {daily.content_text}
        </p>
        {daily.verse_reference && (
          <p className="mt-1 text-xs italic text-text-muted dark:text-text-muted-dark">
            {daily.verse_reference}
          </p>
        )}
        <div className="mt-2 text-xs text-text-muted dark:text-text-muted-dark">
          Saved {relativeTime(bookmark.created_at)}
        </div>
      </div>
    );
  }

  return null;
}

// ---- Main Bookmarks Page ----

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const cursorRef = useRef<string | null>(null);
  const { ref, inView } = useInfiniteScroll();

  const fetchBookmarks = useCallback(
    async (tab: FilterTab, cursor: string | null, append = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '20' });
        if (tab !== 'all') params.set('type', tab);
        if (cursor) params.set('cursor', cursor);

        const res = await fetch(`/api/bookmarks?${params}`, {
          credentials: 'include',
        });

        if (!res.ok) return;

        const data = await res.json();
        setBookmarks((prev) =>
          append ? [...prev, ...data.bookmarks] : data.bookmarks
        );
        setHasMore(data.has_more);
        cursorRef.current = data.next_cursor;
      } catch (err) {
        console.error('[Bookmarks] fetch error:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial fetch and tab change
  useEffect(() => {
    cursorRef.current = null;
    setBookmarks([]);
    fetchBookmarks(activeTab, null);
  }, [activeTab, fetchBookmarks]);

  // Infinite scroll
  useEffect(() => {
    if (inView && hasMore && !loading) {
      fetchBookmarks(activeTab, cursorRef.current, true);
    }
  }, [inView, hasMore, loading, activeTab, fetchBookmarks]);

  const handleUnbookmark = useCallback((bookmarkId: number) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
  }, []);

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'post', label: 'Posts' },
    { key: 'daily', label: 'Daily Content' },
  ];

  return (
    <div className="min-h-[calc(100vh-7.5rem)]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90">
        <h1 className="text-xl font-bold text-text dark:text-text-dark">
          Saved
        </h1>

        {/* Filter tabs */}
        <div className="mt-3 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-text-muted hover:bg-slate-200 dark:bg-slate-800 dark:text-text-muted-dark dark:hover:bg-slate-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        {!loading && bookmarks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <BookmarkX className="h-12 w-12 text-text-muted dark:text-text-muted-dark" />
            <h2 className="text-lg font-semibold text-text dark:text-text-dark">
              No saved posts yet
            </h2>
            <p className="max-w-xs text-sm text-text-muted dark:text-text-muted-dark">
              Bookmark posts to see them here! Tap the bookmark icon on any post to save it.
            </p>
          </div>
        )}

        {bookmarks.map((bookmark) => (
          <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            onUnbookmark={handleUnbookmark}
          />
        ))}

        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={ref} className="h-1" />
      </div>
    </div>
  );
}
