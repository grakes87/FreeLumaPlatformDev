'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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

// Step → progress percentage mapping (ordered by pipeline execution)
const BIBLE_STEP_PROGRESS: Record<string, number> = {
  starting: 2,
  create_row: 5,
  existing_row: 5,
  verse_selection: 12,
  translation_fetch: 22,
  translation_skip: 22,
  devotional_reflection: 38,
  camera_script: 52,
  meditation_script: 62,
  background_prompt: 72,
  tts_complete: 88,
  tts_skip: 88,
  tts_error: 88,
  verse_recorded: 95,
  status_update: 100,
};

const POSITIVITY_STEP_PROGRESS: Record<string, number> = {
  starting: 2,
  create_row: 5,
  existing_row: 5,
  positivity_quote: 18,
  camera_script: 32,
  meditation_script: 46,
  background_prompt: 58,
  meditation_tts: 68,
  meditation_audio: 78,
  meditation_audio_skip: 78,
  meditation_audio_error: 78,
  tts_complete: 90,
  tts_skip: 90,
  tts_error: 90,
  status_update: 100,
};

const STEP_LABELS: Record<string, string> = {
  starting: 'Starting...',
  create_row: 'Creating record',
  existing_row: 'Checking gaps',
  verse_selection: 'Selecting verse',
  translation_fetch: 'Fetching translations',
  translation_skip: 'Fetching translations',
  positivity_quote: 'Generating quote',
  devotional_reflection: 'Writing devotional',
  camera_script: 'Writing camera script',
  meditation_script: 'Writing meditation',
  background_prompt: 'Creating background prompt',
  meditation_tts: 'Generating meditation audio',
  meditation_audio: 'Mixing meditation audio',
  meditation_audio_skip: 'Meditation audio skipped',
  meditation_audio_error: 'Meditation audio failed',
  tts_complete: 'Generating TTS audio',
  tts_skip: 'TTS skipped',
  tts_error: 'TTS error',
  verse_recorded: 'Recording verse',
  status_update: 'Complete',
  fatal: 'Failed',
};

interface DayState {
  status: 'waiting' | 'active' | 'done' | 'error';
  progress: number;
  step: string;
  label: string;
  hasError: boolean;
}

export function GenerationProgressModal({
  open,
  onClose,
  month,
  mode,
  day: singleDay,
}: GenerationProgressModalProps) {
  const [dayStates, setDayStates] = useState<Map<number, DayState>>(new Map());
  const [totalDays, setTotalDays] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [summaryMsg, setSummaryMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeDayRef = useRef<number>(0);

  const stepMap = mode === 'bible' ? BIBLE_STEP_PROGRESS : POSITIVITY_STEP_PROGRESS;

  // Compute total from month
  const daysInMonth = useMemo(() => {
    if (singleDay) return 1;
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [month, singleDay]);

  // Auto-scroll to active day
  useEffect(() => {
    if (scrollRef.current && activeDayRef.current > 0) {
      const el = scrollRef.current.querySelector(`[data-day="${activeDayRef.current}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [dayStates]);

  // Process a single SSE event into day states
  const processEvent = useCallback(
    (event: ProgressEvent) => {
      if (event.type === 'complete') {
        setSummaryMsg(event.message || 'Generation complete');
        return;
      }

      const dayNum = event.day;
      if (!dayNum) return;

      if (event.total && event.total > 0) {
        setTotalDays(event.total);
      }

      activeDayRef.current = dayNum;

      setDayStates((prev) => {
        const next = new Map(prev);

        // Mark previous active days as done (if a new day started)
        for (const [d, state] of next) {
          if (d < dayNum && state.status === 'active') {
            next.set(d, { ...state, status: 'done', progress: 100, label: 'Complete' });
          }
        }

        const step = event.step || '';
        const isError = event.type === 'error' || step === 'fatal';
        const progressPct = isError
          ? (next.get(dayNum)?.progress ?? 0)
          : Math.max(next.get(dayNum)?.progress ?? 0, stepMap[step] ?? 0);

        const isDone = step === 'status_update' && !isError;

        next.set(dayNum, {
          status: isDone ? 'done' : isError ? 'error' : 'active',
          progress: isDone ? 100 : progressPct,
          step,
          label: isError
            ? (event.message || 'Error')
            : (STEP_LABELS[step] || event.message || step),
          hasError: isError || (next.get(dayNum)?.hasError ?? false),
        });

        return next;
      });
    },
    [stepMap]
  );

  // Start generation when modal opens
  const startGeneration = useCallback(async () => {
    setDayStates(new Map());
    setRunning(true);
    setDone(false);
    setSummaryMsg('');
    setTotalDays(daysInMonth);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, unknown> = { month, mode };
      if (singleDay !== undefined) body.day = singleDay;

      const res = await fetch('/api/admin/content-production/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setSummaryMsg(err.error || `HTTP ${res.status}`);
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

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: ProgressEvent = JSON.parse(line.slice(6));
                processEvent(event);
              } catch {
                // Malformed JSON, skip
              }
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setSummaryMsg(`Connection error: ${(err as Error).message}`);
      }
    } finally {
      // Mark any remaining active days as done
      setDayStates((prev) => {
        const next = new Map(prev);
        for (const [d, state] of next) {
          if (state.status === 'active') {
            next.set(d, { ...state, status: 'done', progress: 100, label: 'Complete' });
          }
        }
        return next;
      });
      setRunning(false);
      setDone(true);
      abortRef.current = null;
    }
  }, [month, mode, singleDay, daysInMonth, processEvent]);

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

  const title = singleDay
    ? `Generating Day ${singleDay} (${mode})`
    : `Generating ${mode} content for ${month}`;

  // Build day list
  const total = totalDays || daysInMonth;
  const dayNumbers = singleDay
    ? [singleDay]
    : Array.from({ length: total }, (_, i) => i + 1);

  // Count completed
  const completedCount = Array.from(dayStates.values()).filter(
    (s) => s.status === 'done'
  ).length;
  const errorCount = Array.from(dayStates.values()).filter(
    (s) => s.status === 'error'
  ).length;

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
            {done && !summaryMsg.includes('error') && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-text dark:text-text-dark">{title}</h2>
              <p className="text-xs text-text-muted dark:text-text-muted-dark">
                {running
                  ? `${completedCount} of ${total} days complete${errorCount > 0 ? ` (${errorCount} errors)` : ''}`
                  : done
                    ? summaryMsg || `${completedCount} days generated`
                    : 'Preparing...'}
              </p>
            </div>
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

        {/* Overall progress bar */}
        <div className="px-6 pt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${total > 0 ? ((completedCount + errorCount) / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Day list */}
        <div
          ref={scrollRef}
          className="max-h-[55vh] min-h-[16rem] overflow-y-auto px-6 py-4"
        >
          <div className="space-y-2">
            {dayNumbers.map((dayNum) => {
              const state = dayStates.get(dayNum);
              const [y, m] = month.split('-');
              const dateStr = `${y}-${m}-${String(dayNum).padStart(2, '0')}`;
              const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });

              const status = state?.status ?? 'waiting';
              const progress = state?.progress ?? 0;
              const label = state?.label ?? '';

              return (
                <div
                  key={dayNum}
                  data-day={dayNum}
                  className={cn(
                    'rounded-lg border px-4 py-2.5 transition-colors',
                    status === 'active' && 'border-primary/30 bg-primary/5 dark:border-primary/20 dark:bg-primary/5',
                    status === 'done' && 'border-green-200 bg-green-50/50 dark:border-green-800/30 dark:bg-green-900/10',
                    status === 'error' && 'border-red-200 bg-red-50/50 dark:border-red-800/30 dark:bg-red-900/10',
                    status === 'waiting' && 'border-border/50 bg-transparent dark:border-border-dark/50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {status === 'done' && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      )}
                      {status === 'error' && (
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                      )}
                      {status === 'active' && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      )}
                      {status === 'waiting' && (
                        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-200 dark:border-slate-600" />
                      )}
                      <span className={cn(
                        'text-sm font-medium',
                        status === 'waiting'
                          ? 'text-text-muted dark:text-text-muted-dark'
                          : 'text-text dark:text-text-dark'
                      )}>
                        {dateLabel}
                      </span>
                    </div>
                    {status !== 'waiting' && (
                      <span className={cn(
                        'text-xs',
                        status === 'active' && 'text-primary',
                        status === 'done' && 'text-green-600 dark:text-green-400',
                        status === 'error' && 'text-red-600 dark:text-red-400',
                      )}>
                        {label}
                      </span>
                    )}
                  </div>

                  {/* Per-day progress bar (only for active/done/error) */}
                  {status !== 'waiting' && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300 ease-out',
                          status === 'done' && 'bg-green-500',
                          status === 'error' && 'bg-red-400',
                          status === 'active' && 'bg-primary',
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
