'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, MessageSquare, FileText, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { ModerationActionModal } from './ModerationActionModal';

interface Reporter {
  id: number;
  reporter_id: number;
  reporter_username: string;
  reporter_display_name: string;
  reason: string;
  details: string | null;
  created_at: string;
}

interface ReportGroup {
  content_type: 'post' | 'comment';
  content_id: number;
  content_preview: string;
  content_deleted: boolean;
  author: {
    id: number;
    username: string;
    display_name: string;
  } | null;
  report_count: number;
  reports: Reporter[];
  status: string;
  first_reported_at: string;
}

type StatusFilter = 'pending' | 'reviewed' | 'dismissed';
type ContentTypeFilter = 'all' | 'post' | 'comment';

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_speech: 'Hate Speech',
  inappropriate: 'Inappropriate',
  self_harm: 'Self Harm',
  other: 'Other',
  profanity_filter: 'Auto-flagged',
};

function formatRelativeDate(dateStr: string): string {
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
  return date.toLocaleDateString();
}

export function ModerationQueue() {
  const toast = useToast();
  const [items, setItems] = useState<ReportGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all');
  const [counts, setCounts] = useState({ pending: 0, reviewed: 0, dismissed: 0 });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReportGroup | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchQueue = useCallback(async (cursorVal?: string) => {
    if (cursorVal) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: '20',
      });
      if (contentTypeFilter !== 'all') {
        params.set('content_type', contentTypeFilter);
      }
      if (cursorVal) {
        params.set('cursor', cursorVal);
      }

      const res = await fetch(`/api/admin/moderation?${params}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        const responseData = data.data || data;
        const newItems = responseData.items || [];

        if (cursorVal) {
          setItems((prev) => [...prev, ...newItems]);
        } else {
          setItems(newItems);
        }

        setCounts(responseData.counts || { pending: 0, reviewed: 0, dismissed: 0 });
        setNextCursor(responseData.next_cursor || null);
        setHasMore(responseData.has_more || false);
      }
    } catch {
      toast.error('Failed to load moderation queue');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, contentTypeFilter, toast]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchQueue(nextCursor);
    }
  };

  const handleTakeAction = (item: ReportGroup) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  const handleActionComplete = (contentId: number, contentType: string) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.content_id === contentId && i.content_type === contentType)
      )
    );
    setCounts((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - 1),
    }));
  };

  const statusTabs: { key: StatusFilter; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'reviewed', label: 'Reviewed', count: counts.reviewed },
    { key: 'dismissed', label: 'Dismissed', count: counts.dismissed },
  ];

  const contentTypeTabs: { key: ContentTypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'post', label: 'Posts' },
    { key: 'comment', label: 'Comments' },
  ];

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              statusFilter === tab.key
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-muted hover:text-text dark:bg-surface-hover-dark dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Type Filter */}
      <div className="flex gap-2">
        {contentTypeTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setContentTypeFilter(tab.key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              contentTypeFilter === tab.key
                ? 'bg-text/10 text-text dark:bg-text-dark/10 dark:text-text-dark'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Queue Items */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface py-16 text-center dark:border-border-dark dark:bg-surface-dark">
          <AlertTriangle className="mx-auto h-10 w-10 text-text-muted dark:text-text-muted-dark" />
          <p className="mt-3 text-text-muted dark:text-text-muted-dark">
            No pending reports
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            // Aggregate unique reasons for display
            const reasonCounts: Record<string, number> = {};
            for (const r of item.reports) {
              reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
            }

            return (
              <div
                key={`${item.content_type}-${item.content_id}`}
                className="rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-sm dark:border-border-dark dark:bg-surface-dark"
              >
                {/* Header Row */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {item.content_type === 'post' ? (
                      <FileText className="h-4 w-4 text-blue-500" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-xs font-medium uppercase tracking-wide text-text-muted dark:text-text-muted-dark">
                      {item.content_type}
                    </span>
                    {/* Report count badge */}
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {item.report_count} {item.report_count === 1 ? 'report' : 'reports'}
                    </span>
                    {item.content_deleted && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        DELETED
                      </span>
                    )}
                  </div>
                  <time className="whitespace-nowrap text-xs text-text-muted dark:text-text-muted-dark">
                    {formatRelativeDate(item.first_reported_at)}
                  </time>
                </div>

                {/* Content Preview */}
                <div className="mb-3 rounded-xl bg-background p-3 dark:bg-background-dark">
                  {item.author && (
                    <p className="mb-1 text-xs font-medium text-text dark:text-text-dark">
                      @{item.author.username}
                    </p>
                  )}
                  <p className="text-sm text-text dark:text-text-dark">
                    {item.content_preview || 'Content unavailable'}
                  </p>
                </div>

                {/* Reasons summary */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {Object.entries(reasonCounts).map(([reason, count]) => (
                    <span
                      key={reason}
                      className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    >
                      {REASON_LABELS[reason] || reason}
                      {count > 1 && ` (${count})`}
                    </span>
                  ))}
                </div>

                {/* Action Button */}
                {statusFilter === 'pending' && (
                  <button
                    onClick={() => handleTakeAction(item)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    Take Action
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
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
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Modal */}
      <ModerationActionModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedItem(null); }}
        item={selectedItem}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}
