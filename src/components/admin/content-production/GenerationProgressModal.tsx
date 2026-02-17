'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';

interface ProgressEvent {
  type: 'progress' | 'error' | 'complete';
  day?: number;
  total?: number;
  step?: string;
  message?: string;
  error?: string;
}

interface GenerationProgressModalProps {
  open: boolean;
  onClose: () => void;
  month: string;
  mode: 'bible' | 'positivity';
  /** If provided, generates a single day. Otherwise full month. */
  day?: number;
}

export function GenerationProgressModal({
  open,
  onClose,
  month,
  mode,
  day,
}: GenerationProgressModalProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll the log area
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  // Start generation when modal opens
  const startGeneration = useCallback(async () => {
    setEvents([]);
    setRunning(true);
    setDone(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, unknown> = { month, mode };
      if (day !== undefined) body.day = day;

      const res = await fetch('/api/admin/content-production/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setEvents((prev) => [
          ...prev,
          { type: 'error', message: err.error || `HTTP ${res.status}` },
        ]);
        setRunning(false);
        setDone(true);
        return;
      }

      // Read the SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (data: {...}\n\n)
        const parts = buffer.split('\n\n');
        // Keep the last incomplete chunk in the buffer
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: ProgressEvent = JSON.parse(line.slice(6));
                setEvents((prev) => [...prev, event]);

                if (event.type === 'complete' || event.type === 'error') {
                  setDone(true);
                }
              } catch {
                // Malformed JSON, skip
              }
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setEvents((prev) => [
          ...prev,
          {
            type: 'error',
            message: `Connection error: ${(err as Error).message}`,
          },
        ]);
      }
    } finally {
      setRunning(false);
      setDone(true);
      abortRef.current = null;
    }
  }, [month, mode, day]);

  useEffect(() => {
    if (open) {
      startGeneration();
    }

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [open, startGeneration]);

  const handleClose = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    onClose();
  };

  if (!open) return null;

  const title = day
    ? `Generating Day ${day} (${mode})`
    : `Generating ${mode} content for ${month}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Panel */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col rounded-2xl bg-surface shadow-xl dark:bg-surface-dark">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 dark:border-border-dark">
          <div className="flex items-center gap-3">
            {running && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            <h2 className="text-lg font-semibold text-text dark:text-text-dark">{title}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={running}
            className={cn(
              'rounded-lg p-1 text-text-muted transition-colors hover:bg-slate-100 hover:text-text dark:text-text-muted-dark dark:hover:bg-slate-800 dark:hover:text-text-dark',
              running && 'pointer-events-none opacity-40'
            )}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrolling log */}
        <div
          ref={logRef}
          className="max-h-[60vh] min-h-[16rem] overflow-y-auto px-6 py-4 font-mono text-sm"
        >
          {events.length === 0 && running && (
            <p className="text-text-muted dark:text-text-muted-dark">
              Starting generation...
            </p>
          )}
          {events.map((event, i) => (
            <div
              key={i}
              className={cn(
                'py-0.5',
                event.type === 'error' && 'text-red-600 dark:text-red-400',
                event.type === 'complete' && 'font-medium text-green-600 dark:text-green-400',
                event.type === 'progress' && 'text-text-muted dark:text-text-muted-dark'
              )}
            >
              {event.day !== undefined && event.total !== undefined && (
                <span className="mr-2 text-xs text-text-muted/60 dark:text-text-muted-dark/60">
                  [{event.day}/{event.total}]
                </span>
              )}
              {event.step && (
                <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-700">
                  {event.step}
                </span>
              )}
              {event.message || event.error || ''}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 dark:border-border-dark">
          <div className="flex justify-end">
            <Button
              onClick={handleClose}
              disabled={running}
              variant={done ? 'primary' : 'secondary'}
            >
              {done ? 'Done' : 'Cancel'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
