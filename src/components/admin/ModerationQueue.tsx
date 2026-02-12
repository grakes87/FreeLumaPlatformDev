'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Trash2, X, AlertTriangle, MessageSquare, FileText, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface ModerationItem {
  id: string | number;
  item_type: 'report' | 'flagged_post' | 'flagged_comment';
  content_type: 'post' | 'comment';
  reason: string;
  details?: string;
  status?: string;
  created_at: string;
  reporter?: {
    id: number;
    display_name: string;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
  };
  post?: {
    id: number;
    body: string;
    user_id: number;
    post_type: string;
    flagged: boolean;
    deleted_at: string | null;
    created_at: string;
    user?: {
      id: number;
      display_name: string;
      username: string;
      avatar_url: string | null;
      avatar_color: string;
    };
  };
  comment?: {
    id: number;
    body: string;
    user_id: number;
    flagged: boolean;
    user?: {
      id: number;
      display_name: string;
      username: string;
      avatar_url: string | null;
      avatar_color: string;
    };
  };
}

type StatusFilter = 'pending' | 'reviewed' | 'actioned' | 'dismissed' | 'all';
type TypeFilter = 'all' | 'report' | 'flagged';

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_speech: 'Hate Speech',
  inappropriate: 'Inappropriate',
  self_harm: 'Self Harm',
  other: 'Other',
  profanity_filter: 'Auto-flagged (profanity)',
};

export function ModerationQueue() {
  const toast = useToast();
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [counts, setCounts] = useState({ pending: 0, reviewed: 0, actioned: 0 });
  const [actioningId, setActioningId] = useState<string | number | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [showNotesFor, setShowNotesFor] = useState<string | number | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        type: typeFilter,
        limit: '20',
      });
      const res = await fetch(`/api/admin/moderation?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setCounts(data.counts || { pending: 0, reviewed: 0, actioned: 0 });
      }
    } catch {
      toast.error('Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, toast]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleAction = async (
    item: ModerationItem,
    action: 'approve' | 'remove' | 'dismiss'
  ) => {
    const itemKey = String(item.id);
    setActioningId(item.id);

    try {
      // Determine the real DB ID for the API call
      let apiId: number;
      if (item.item_type === 'report') {
        apiId = item.id as number;
      } else if (item.item_type === 'flagged_post') {
        apiId = item.post?.id || 0;
      } else {
        apiId = item.comment?.id || 0;
      }

      const res = await fetch(`/api/admin/moderation/${apiId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          item_type: item.item_type,
          admin_notes: notesMap[itemKey] || undefined,
        }),
      });

      if (res.ok) {
        toast.success(
          action === 'approve'
            ? 'Content approved'
            : action === 'remove'
            ? 'Content removed'
            : 'Report dismissed'
        );
        // Remove item from local list
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        const data = await res.json();
        toast.error(data.error || 'Action failed');
      }
    } catch {
      toast.error('Failed to process action');
    } finally {
      setActioningId(null);
      setShowNotesFor(null);
    }
  };

  const statusTabs: { key: StatusFilter; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'reviewed', label: 'Reviewed', count: counts.reviewed },
    { key: 'actioned', label: 'Actioned', count: counts.actioned },
    { key: 'all', label: 'All' },
  ];

  const typeTabs: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'report', label: 'Reports' },
    { key: 'flagged', label: 'Flagged' },
  ];

  return (
    <div className="space-y-6">
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

      {/* Type Filter */}
      <div className="flex gap-2">
        {typeTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTypeFilter(tab.key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              typeFilter === tab.key
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
            No items in this queue
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isActioning = actioningId === item.id;
            const itemKey = String(item.id);
            const contentBody =
              item.content_type === 'post'
                ? item.post?.body
                : item.comment?.body;
            const contentAuthor =
              item.content_type === 'post'
                ? item.post?.user
                : item.comment?.user;

            return (
              <div
                key={itemKey}
                className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
              >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {item.content_type === 'post' ? (
                      <FileText className="h-4 w-4 text-blue-500" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-xs font-medium uppercase tracking-wide text-text-muted dark:text-text-muted-dark">
                      {item.item_type === 'report' ? 'Report' : 'Flagged'} -{' '}
                      {item.content_type}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        item.item_type === 'flagged_post' || item.item_type === 'flagged_comment'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {REASON_LABELS[item.reason] || item.reason}
                    </span>
                  </div>
                  <time className="whitespace-nowrap text-xs text-text-muted dark:text-text-muted-dark">
                    {new Date(item.created_at).toLocaleDateString()}
                  </time>
                </div>

                {/* Content Preview */}
                <div className="mb-3 rounded-xl bg-background p-3 dark:bg-background-dark">
                  {contentAuthor && (
                    <div className="mb-2 flex items-center gap-2">
                      {contentAuthor.avatar_url ? (
                        <img
                          src={contentAuthor.avatar_url}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <InitialsAvatar
                          name={contentAuthor.display_name}
                          color={contentAuthor.avatar_color}
                          size={24}
                        />
                      )}
                      <span className="text-sm font-medium text-text dark:text-text-dark">
                        {contentAuthor.display_name}
                      </span>
                      <span className="text-xs text-text-muted dark:text-text-muted-dark">
                        @{contentAuthor.username}
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-text dark:text-text-dark">
                    {contentBody && contentBody.length > 200
                      ? contentBody.substring(0, 200) + '...'
                      : contentBody || 'Content unavailable'}
                  </p>
                </div>

                {/* Reporter info (for reports) */}
                {item.item_type === 'report' && item.reporter && (
                  <div className="mb-3 text-xs text-text-muted dark:text-text-muted-dark">
                    Reported by{' '}
                    <span className="font-medium">
                      @{item.reporter.username}
                    </span>
                    {item.details && (
                      <span className="ml-1">- &quot;{item.details}&quot;</span>
                    )}
                  </div>
                )}

                {/* Admin Notes Toggle */}
                {showNotesFor === item.id && (
                  <div className="mb-3">
                    <textarea
                      placeholder="Admin notes (optional)"
                      value={notesMap[itemKey] || ''}
                      onChange={(e) =>
                        setNotesMap((prev) => ({
                          ...prev,
                          [itemKey]: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted dark:border-border-dark dark:bg-background-dark dark:text-text-dark dark:placeholder:text-text-muted-dark"
                      rows={2}
                    />
                  </div>
                )}

                {/* Actions */}
                {(statusFilter === 'pending' || statusFilter === 'all') &&
                  (item.status === 'pending' || !item.status) && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction(item, 'approve')}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-500/20 disabled:opacity-50 dark:text-green-400"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(item, 'remove')}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                      <button
                        onClick={() => handleAction(item, 'dismiss')}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 rounded-lg bg-gray-500/10 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-500/20 disabled:opacity-50 dark:text-gray-400"
                      >
                        <X className="h-3.5 w-3.5" />
                        Dismiss
                      </button>
                      <button
                        onClick={() =>
                          setShowNotesFor((prev) =>
                            prev === item.id ? null : item.id
                          )
                        }
                        className="ml-auto flex items-center gap-1 text-xs text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
                      >
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform',
                            showNotesFor === item.id && 'rotate-180'
                          )}
                        />
                        Notes
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
