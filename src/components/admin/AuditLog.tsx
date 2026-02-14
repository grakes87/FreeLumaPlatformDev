'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, ScrollText, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';

interface AuditAdmin {
  id: number;
  username: string;
  display_name: string;
}

interface AuditEntry {
  id: number;
  admin: AuditAdmin | null;
  action: string;
  target_user: AuditAdmin | null;
  target_content_type: string | null;
  target_content_id: number | null;
  reason: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type ActionFilter = 'all' | 'remove_content' | 'warn_user' | 'ban_user' | 'unban_user' | 'dismiss_report' | 'edit_user';

const ACTION_BADGE_STYLES: Record<string, string> = {
  remove_content: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warn_user: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ban_user: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  unban_user: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  dismiss_report: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  edit_user: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const ACTION_LABELS: Record<string, string> = {
  remove_content: 'Removed Content',
  warn_user: 'Warned User',
  ban_user: 'Banned User',
  unban_user: 'Unbanned User',
  dismiss_report: 'Dismissed Report',
  edit_user: 'Edited User',
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString();
}

export function AuditLog() {
  const toast = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLog = useCallback(
    async (cursorVal?: string) => {
      if (cursorVal) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({ limit: '30' });
        if (search.trim()) params.set('search', search.trim());
        if (actionFilter !== 'all') params.set('action', actionFilter);
        if (dateFrom) params.set('from', new Date(dateFrom).toISOString());
        if (dateTo) params.set('to', new Date(dateTo + 'T23:59:59').toISOString());
        if (cursorVal) params.set('cursor', cursorVal);

        const res = await fetch(`/api/admin/audit-log?${params}`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          const responseData = data.data || data;
          const newEntries = responseData.entries || [];

          if (cursorVal) {
            setEntries((prev) => [...prev, ...newEntries]);
          } else {
            setEntries(newEntries);
          }
          setNextCursor(responseData.next_cursor || null);
          setHasMore(responseData.has_more || false);
        }
      } catch {
        toast.error('Failed to load audit log');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, actionFilter, dateFrom, dateTo, toast]
  );

  useEffect(() => {
    const timer = setTimeout(() => fetchLog(), 300);
    return () => clearTimeout(timer);
  }, [fetchLog]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchLog(nextCursor);
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
          placeholder="Search reasons..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-text outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:focus:border-primary"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Action Filter */}
        <div className="relative">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
            className="appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-medium text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          >
            <option value="all">All Actions</option>
            <option value="remove_content">Remove Content</option>
            <option value="warn_user">Warn User</option>
            <option value="ban_user">Ban User</option>
            <option value="unban_user">Unban User</option>
            <option value="dismiss_report">Dismiss Report</option>
            <option value="edit_user">Edit User</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>

        {/* Date Range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          placeholder="To"
        />
      </div>

      {/* Audit Entries */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface py-16 text-center dark:border-border-dark dark:bg-surface-dark">
          <ScrollText className="mx-auto h-10 w-10 text-text-muted dark:text-text-muted-dark" />
          <p className="mt-3 text-text-muted dark:text-text-muted-dark">
            No audit log entries found
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const reasonTruncated = entry.reason.length > 100;

            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
              >
                <div className="flex items-start gap-3">
                  {/* Timestamp */}
                  <div className="w-16 shrink-0 pt-0.5">
                    <time
                      className="text-xs text-text-muted dark:text-text-muted-dark"
                      title={new Date(entry.created_at).toLocaleString()}
                    >
                      {formatRelativeTime(entry.created_at)}
                    </time>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Action badge */}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          ACTION_BADGE_STYLES[entry.action] || ACTION_BADGE_STYLES.edit_user
                        )}
                      >
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>

                      {/* Admin */}
                      {entry.admin && (
                        <span className="text-xs text-text-muted dark:text-text-muted-dark">
                          by <span className="font-medium text-text dark:text-text-dark">@{entry.admin.username}</span>
                        </span>
                      )}

                      {/* Target */}
                      {entry.target_user && (
                        <span className="text-xs text-text-muted dark:text-text-muted-dark">
                          on <span className="font-medium text-text dark:text-text-dark">@{entry.target_user.username}</span>
                        </span>
                      )}

                      {/* Content reference */}
                      {entry.target_content_type && entry.target_content_id && (
                        <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
                          ({entry.target_content_type} #{entry.target_content_id})
                        </span>
                      )}
                    </div>

                    {/* Reason */}
                    <p className="mt-1.5 text-sm text-text dark:text-text-dark">
                      {isExpanded || !reasonTruncated
                        ? entry.reason
                        : entry.reason.substring(0, 100) + '...'}
                    </p>

                    {reasonTruncated && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="mt-1 text-[10px] font-medium text-primary"
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}

                    {/* Metadata (expanded) */}
                    {isExpanded && entry.metadata && (
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-2 text-[10px] text-text-muted dark:bg-background-dark dark:text-text-muted-dark">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

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
