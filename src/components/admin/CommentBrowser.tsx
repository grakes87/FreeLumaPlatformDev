'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  Flag,
  ChevronDown,
  AlertTriangle,
  MessageSquare,
  CornerDownRight,
  EyeOff,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface CommentAuthor {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
}

interface AdminComment {
  id: number;
  body: string;
  post_id: number;
  parent_id: number | null;
  flagged: boolean;
  hidden: boolean;
  edited: boolean;
  created_at: string;
  author: CommentAuthor | null;
  post_preview: string | null;
  report_count: number;
}

type FlagFilter = 'all' | 'flagged';
type HiddenFilter = 'all' | 'visible' | 'hidden';

export function CommentBrowser() {
  const toast = useToast();
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [flagFilter, setFlagFilter] = useState<FlagFilter>('all');
  const [hiddenFilter, setHiddenFilter] = useState<HiddenFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchComments = useCallback(
    async (cursorVal?: string) => {
      if (cursorVal) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({ limit: '20' });
        if (search.trim()) params.set('search', search.trim());
        if (flagFilter === 'flagged') params.set('flagged', 'true');
        if (hiddenFilter === 'hidden') params.set('hidden', 'true');
        if (hiddenFilter === 'visible') params.set('hidden', 'false');
        if (dateFrom) params.set('from', dateFrom);
        if (dateTo) params.set('to', dateTo);
        if (cursorVal) params.set('cursor', cursorVal);

        const res = await fetch(`/api/admin/comments?${params}`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          const newComments = data.comments || [];

          if (cursorVal) {
            setComments((prev) => [...prev, ...newComments]);
          } else {
            setComments(newComments);
          }
          setNextCursor(data.next_cursor || null);
          setHasMore(data.has_more || false);
        }
      } catch {
        toast.error('Failed to load comments');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, flagFilter, hiddenFilter, dateFrom, dateTo, toast]
  );

  useEffect(() => {
    const timer = setTimeout(() => fetchComments(), 300);
    return () => clearTimeout(timer);
  }, [fetchComments]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchComments(nextCursor);
    }
  };

  const toggleHidden = async (comment: AdminComment) => {
    setTogglingId(comment.id);
    try {
      const res = await fetch(`/api/admin/comments/${comment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hidden: !comment.hidden }),
      });

      if (res.ok) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id ? { ...c, hidden: !comment.hidden } : c
          )
        );
        toast.success(comment.hidden ? 'Comment unhidden' : 'Comment hidden');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update comment');
      }
    } catch {
      toast.error('Failed to update comment');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search comment content..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-text outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:focus:border-primary"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value as FlagFilter)}
            className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-medium text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          >
            <option value="all">All Comments</option>
            <option value="flagged">Flagged Only</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>

        <div className="relative">
          <select
            value={hiddenFilter}
            onChange={(e) => setHiddenFilter(e.target.value as HiddenFilter)}
            className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-medium text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          >
            <option value="all">All Visibility</option>
            <option value="visible">Visible Only</option>
            <option value="hidden">Hidden Only</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>
      </div>

      {/* Date Range */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-text-muted dark:text-text-muted-dark">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />
        <label className="text-xs font-medium text-text-muted dark:text-text-muted-dark">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-primary hover:underline"
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted dark:text-text-muted-dark">
          No comments found.
        </p>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                'rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark',
                comment.flagged && 'border-l-4 border-l-red-400',
                comment.hidden && !comment.flagged && 'border-l-4 border-l-amber-400'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Author Avatar */}
                {comment.author ? (
                  comment.author.avatar_url ? (
                    <img
                      src={comment.author.avatar_url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar
                      name={comment.author.display_name}
                      color={comment.author.avatar_color}
                      size={36}
                      className="shrink-0"
                    />
                  )
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                    <span className="text-xs text-gray-500">?</span>
                  </div>
                )}

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-text dark:text-text-dark">
                      {comment.author ? `@${comment.author.username}` : 'Unknown'}
                    </span>
                    <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
                      #{comment.id}
                    </span>

                    {comment.parent_id && (
                      <span className="flex items-center gap-0.5 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <CornerDownRight className="h-2.5 w-2.5" />
                        reply
                      </span>
                    )}

                    {comment.flagged && (
                      <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <Flag className="h-2.5 w-2.5" />
                        flagged
                      </span>
                    )}

                    {comment.hidden && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <EyeOff className="h-2.5 w-2.5" />
                        hidden
                      </span>
                    )}

                    {comment.report_count > 0 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {comment.report_count} report{comment.report_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-text dark:text-text-dark line-clamp-2">
                    {comment.body}
                  </p>

                  {/* Parent post preview */}
                  {comment.post_preview && (
                    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-surface-hover p-2 dark:bg-surface-hover-dark">
                      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-text-muted dark:text-text-muted-dark" />
                      <p className="text-xs text-text-muted dark:text-text-muted-dark line-clamp-1">
                        on post #{comment.post_id}: {comment.post_preview}
                      </p>
                    </div>
                  )}

                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-text-muted dark:text-text-muted-dark">
                    <span>{new Date(comment.created_at).toLocaleString()}</span>
                    {comment.edited && <span>Edited</span>}
                  </div>
                </div>

                {/* Hide/Unhide Button */}
                <button
                  onClick={() => toggleHidden(comment)}
                  disabled={togglingId === comment.id}
                  className={cn(
                    'rounded-lg p-1.5 transition-colors',
                    comment.hidden
                      ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark'
                  )}
                  title={comment.hidden ? 'Unhide comment' : 'Hide comment'}
                >
                  {togglingId === comment.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : comment.hidden ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-xl bg-surface-hover px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text disabled:opacity-50 dark:bg-surface-hover-dark dark:text-text-muted-dark dark:hover:text-text-dark"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
