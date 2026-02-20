'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueueItem {
  /** Client-generated unique key */
  id: string;
  /** Server-side generation log ID (set after API responds or after polling) */
  log_id?: number;
  daily_content_id: number;
  post_date: string;
  field: string;
  translation_code?: string;
  mode?: 'bible' | 'positivity';
  language?: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  error?: string;
  started_at: number;
  completed_at?: number;
}

const STORAGE_KEY = 'fl_generation_queue';
const STALE_CHECK_INTERVAL = 5000; // poll every 5s for stale items
const SUCCESS_DISMISS_MS = 30_000; // auto-dismiss success items after 30s

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------

function loadQueue(): QueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: QueueItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full or unavailable
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GenerationQueueProps {
  /** Called externally to add a new item to the queue */
  onRef?: (api: GenerationQueueAPI) => void;
}

export interface GenerationQueueAPI {
  addItem: (item: Omit<QueueItem, 'id' | 'status' | 'started_at'>) => string;
  /** Add multiple items at once as 'queued' (not yet running) */
  bulkAddItems: (items: Array<Omit<QueueItem, 'id' | 'status' | 'started_at'>>) => string[];
  /** Transition a queued item to running */
  setItemRunning: (id: string) => void;
  resolveItem: (id: string, status: 'success' | 'failed', error?: string, logId?: number) => void;
}

export function GenerationQueue({ onRef }: GenerationQueueProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0); // force re-render for elapsed time
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const itemsRef = useRef<QueueItem[]>(items);
  itemsRef.current = items;

  // Tick every second while items are running (to update elapsed time)
  useEffect(() => {
    const hasActive = items.some((i) => i.status === 'running' || i.status === 'queued');
    if (!hasActive) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [items]);

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = loadQueue();
    if (stored.length > 0) setItems(stored);
  }, []);

  // Persist to localStorage whenever items change
  useEffect(() => {
    if (mounted) saveQueue(items);
  }, [items, mounted]);

  // Auto-dismiss success items after timeout
  useEffect(() => {
    const successItems = items.filter(
      (i) => i.status === 'success' && i.completed_at
    );
    if (successItems.length === 0) return;

    const timers = successItems.map((item) => {
      const elapsed = Date.now() - (item.completed_at ?? 0);
      const remaining = Math.max(SUCCESS_DISMISS_MS - elapsed, 0);
      return setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }, remaining);
    });

    return () => timers.forEach(clearTimeout);
  }, [items]);

  // Poll for stale "running" items after page refresh
  useEffect(() => {
    if (!mounted) return;

    const checkStale = async () => {
      const running = itemsRef.current.filter((i) => i.status === 'running');
      if (running.length === 0) return;

      // For each running item, check the logs API
      for (const item of running) {
        try {
          const res = await fetch(
            `/api/admin/content-production/logs?daily_content_id=${item.daily_content_id}`,
            { credentials: 'include' }
          );
          if (!res.ok) continue;
          const json = await res.json();
          const logs: Array<{
            id: number;
            field: string;
            translation_code: string | null;
            status: 'started' | 'success' | 'failed';
            error_message: string | null;
          }> = json.data ?? json;

          // Find a matching log entry that completed after our item started
          const match = logs.find(
            (l) =>
              l.field === item.field &&
              l.translation_code === (item.translation_code ?? null) &&
              (l.status === 'success' || l.status === 'failed')
          );

          if (match) {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: match.status === 'success' ? 'success' : 'failed',
                      error: match.error_message ?? undefined,
                      log_id: match.id,
                      completed_at: Date.now(),
                    }
                  : i
              )
            );
          }
        } catch {
          // Network error — will retry next interval
        }
      }
    };

    // Run once immediately, then on interval
    checkStale();
    pollingRef.current = setInterval(checkStale, STALE_CHECK_INTERVAL);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [mounted]);

  // API for parent to add/resolve items
  const addItem = useCallback(
    (partial: Omit<QueueItem, 'id' | 'status' | 'started_at'>): string => {
      const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const item: QueueItem = {
        ...partial,
        id,
        status: 'running',
        started_at: Date.now(),
      };
      setItems((prev) => [item, ...prev]);
      setExpanded(true);
      return id;
    },
    []
  );

  const bulkAddItems = useCallback(
    (partials: Array<Omit<QueueItem, 'id' | 'status' | 'started_at'>>): string[] => {
      const now = Date.now();
      const newItems: QueueItem[] = partials.map((partial, i) => ({
        ...partial,
        id: `gen_${now}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        status: 'queued' as const,
        started_at: now,
      }));
      setItems((prev) => [...newItems, ...prev]);
      setExpanded(true);
      return newItems.map((item) => item.id);
    },
    []
  );

  const setItemRunning = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: 'running' as const, started_at: Date.now() } : i
        )
      );
    },
    []
  );

  const resolveItem = useCallback(
    (id: string, status: 'success' | 'failed', error?: string, logId?: number) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status, error, log_id: logId ?? i.log_id, completed_at: Date.now() }
            : i
        )
      );
    },
    []
  );

  // Expose API to parent
  useEffect(() => {
    if (onRef) onRef({ addItem, bulkAddItems, setItemRunning, resolveItem });
  }, [onRef, addItem, bulkAddItems, setItemRunning, resolveItem]);

  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === 'running' || i.status === 'queued'));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Don't render if no items or not mounted
  if (!mounted || items.length === 0) return null;

  const queuedCount = items.filter((i) => i.status === 'queued').length;
  const runningCount = items.filter((i) => i.status === 'running').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const successCount = items.filter((i) => i.status === 'success').length;

  const fieldLabel = (item: QueueItem) => {
    const f = item.field.replace(/_/g, ' ');
    return item.translation_code ? `${item.translation_code} ${f}` : f;
  };

  const dateLabel = (postDate: string) => {
    return new Date(postDate + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[90] w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl dark:border-border-dark dark:bg-surface-dark"
      style={{ maxHeight: expanded ? '32rem' : 'auto' }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left dark:border-border-dark"
      >
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-text dark:text-text-dark">
          Generation Queue
        </span>

        {/* Status badges */}
        <div className="ml-auto flex items-center gap-1.5">
          {queuedCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {queuedCount}
            </span>
          )}
          {runningCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {runningCount}
            </span>
          )}
          {successCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
              <Check className="h-2.5 w-2.5" />
              {successCount}
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <X className="h-2.5 w-2.5" />
              {failedCount}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-text-muted dark:text-text-muted-dark" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-text-muted dark:text-text-muted-dark" />
          )}
        </div>
      </button>

      {/* Expanded list */}
      {expanded && (
        <>
          <div className="max-h-72 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-start gap-2 border-b border-border/50 px-3 py-2 last:border-0 dark:border-border-dark/50',
                  item.status === 'failed' && 'bg-red-50/50 dark:bg-red-950/20'
                )}
              >
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {item.status === 'queued' && (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                  )}
                  {item.status === 'running' && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                  )}
                  {item.status === 'success' && (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  )}
                  {item.status === 'failed' && (
                    <X className="h-3.5 w-3.5 text-red-500" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text dark:text-text-dark">
                    {fieldLabel(item)}
                  </p>
                  <p className="text-[10px] text-text-muted dark:text-text-muted-dark">
                    {dateLabel(item.post_date)}
                    {item.language && (
                      <span className="ml-1 uppercase">{item.language}</span>
                    )}
                    {item.mode && (
                      <span className="ml-1 capitalize">{item.mode}</span>
                    )}
                    {item.status === 'queued' && (
                      <span className="ml-1 text-slate-400">queued</span>
                    )}
                    {item.status === 'running' && (
                      <span className="ml-1">
                        ({Math.round((Date.now() - item.started_at) / 1000)}s)
                      </span>
                    )}
                    {item.completed_at && item.status !== 'running' && (
                      <span className="ml-1">
                        ({((item.completed_at - item.started_at) / 1000).toFixed(1)}s)
                      </span>
                    )}
                  </p>
                  {item.error && (
                    <p className="mt-0.5 text-[10px] text-red-500 line-clamp-2" title={item.error}>
                      {item.error}
                    </p>
                  )}
                </div>

                {/* Remove button (not while running) */}
                {item.status !== 'running' && item.status !== 'queued' && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 rounded p-0.5 text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Footer actions */}
          {(successCount > 0 || failedCount > 0) && (
            <div className="flex items-center justify-between border-t border-border px-3 py-1.5 dark:border-border-dark">
              <button
                type="button"
                onClick={clearCompleted}
                className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
              >
                <Trash2 className="h-2.5 w-2.5" />
                Clear finished
              </button>
              {runningCount === 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[10px] font-medium text-text-muted hover:text-red-500 dark:text-text-muted-dark"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  );
}
