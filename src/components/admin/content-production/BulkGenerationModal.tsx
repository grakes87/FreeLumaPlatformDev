'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Loader2,
  Check,
  X,
  Play,
  Square,
  ChevronDown,
  ChevronRight,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { DayData } from './DayCard';
import type { GenerationQueueAPI } from './GenerationQueue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

interface GeneratableItem {
  id: string;
  dayId: number;
  postDate: string;
  field: string;
  translationCode?: string;
  label: string;
  phase: number; // 1=content fields, 2=translation text, 3=TTS
  status: ItemStatus;
  error?: string;
}

interface BulkGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  days: DayData[];
  mode: 'bible' | 'positivity';
  expectedTranslations: string[];
  queueApi: GenerationQueueAPI | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDayUpdate: (dayId: number, field: string, translationCode: string | undefined, content: Record<string, any>) => void;
  onComplete: () => void; // refresh data when done
}

// ---------------------------------------------------------------------------
// Build the list of all generatable missing items
// ---------------------------------------------------------------------------

function buildGeneratableItems(
  days: DayData[],
  mode: 'bible' | 'positivity',
  expectedTranslations: string[]
): GeneratableItem[] {
  const items: GeneratableItem[] = [];

  for (const day of days) {
    if (day.status === 'empty') continue;

    // Phase 1: Content-level fields
    if (!day.has_camera_script) {
      items.push({
        id: `${day.id}_camera_script`,
        dayId: day.id,
        postDate: day.post_date,
        field: 'camera_script',
        label: 'Camera Script',
        phase: 1,
        status: 'pending',
      });
    }
    if (mode === 'positivity' && !day.has_meditation) {
      items.push({
        id: `${day.id}_meditation_script`,
        dayId: day.id,
        postDate: day.post_date,
        field: 'meditation_script',
        label: 'Meditation Script',
        phase: 1,
        status: 'pending',
      });
    }
    if (mode === 'positivity' && day.has_meditation && !day.has_meditation_audio) {
      items.push({
        id: `${day.id}_meditation_audio`,
        dayId: day.id,
        postDate: day.post_date,
        field: 'meditation_audio',
        label: 'Meditation Audio',
        phase: 2,
        status: 'pending',
      });
    }
    if (!day.has_background_prompt) {
      items.push({
        id: `${day.id}_background_prompt`,
        dayId: day.id,
        postDate: day.post_date,
        field: 'background_prompt',
        label: 'BG Prompt',
        phase: 1,
        status: 'pending',
      });
    }

    // Phase 2 & 3: Translation-level fields (bible mode only)
    if (mode === 'bible') {
      const existing = new Map(
        day.translations.map((t) => [t.translation_code, t])
      );

      for (const code of expectedTranslations) {
        const t = existing.get(code);

        // Phase 2: Missing translation text / chapter text
        if (!t || !t.has_translated_text || !t.has_chapter_text) {
          items.push({
            id: `${day.id}_chapter_text_${code}`,
            dayId: day.id,
            postDate: day.post_date,
            field: 'chapter_text',
            translationCode: code,
            label: `${code} Text`,
            phase: 2,
            status: 'pending',
          });
        }

        // Phase 3: Missing TTS (only if chapter_text exists OR we're generating it in phase 2)
        if (!t || !t.has_audio || !t.has_srt) {
          const willHaveChapterText = t?.has_chapter_text ||
            items.some((i) => i.id === `${day.id}_chapter_text_${code}`);
          items.push({
            id: `${day.id}_tts_${code}`,
            dayId: day.id,
            postDate: day.post_date,
            field: 'tts',
            translationCode: code,
            label: `${code} TTS`,
            phase: willHaveChapterText ? 3 : 3, // always phase 3, may get skipped if no text
            status: 'pending',
          });
        }
      }
    }
  }

  // Sort by phase, then by date
  items.sort((a, b) => {
    if (a.phase !== b.phase) return a.phase - b.phase;
    return a.postDate.localeCompare(b.postDate);
  });

  return items;
}

// ---------------------------------------------------------------------------
// Concurrency
// ---------------------------------------------------------------------------

const CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkGenerationModal({
  isOpen,
  onClose,
  days,
  mode,
  expectedTranslations,
  queueApi,
  onDayUpdate,
  onComplete,
}: BulkGenerationModalProps) {
  const [items, setItems] = useState<GeneratableItem[]>([]);
  const [running, setRunning] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  // Track item results across phases so TTS can check if chapter_text failed
  const resultMapRef = useRef(new Map<string, 'success' | 'failed' | 'skipped'>());

  // Build items only when modal opens — NOT on every days change during generation
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      const newItems = buildGeneratableItems(days, mode, expectedTranslations);
      setItems(newItems);
      setActiveCount(0);
      setCurrentPhase(0);
      cancelledRef.current = false;
      resultMapRef.current = new Map();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, days, mode, expectedTranslations]);

  // Group items by day for display
  const dayGroups = useMemo(() => {
    const groups = new Map<string, { postDate: string; dayId: number; items: GeneratableItem[] }>();
    for (const item of items) {
      const key = `${item.dayId}`;
      if (!groups.has(key)) {
        groups.set(key, { postDate: item.postDate, dayId: item.dayId, items: [] });
      }
      groups.get(key)!.items.push(item);
    }
    return Array.from(groups.values()).sort((a, b) => a.postDate.localeCompare(b.postDate));
  }, [items]);

  const stats = useMemo(() => {
    const total = items.length;
    const success = items.filter((i) => i.status === 'success').length;
    const failed = items.filter((i) => i.status === 'failed').length;
    const skipped = items.filter((i) => i.status === 'skipped').length;
    const completed = success + failed + skipped;
    const pending = items.filter((i) => i.status === 'pending').length;
    return { total, success, failed, skipped, completed, pending };
  }, [items]);

  const toggleDay = useCallback((dayId: number) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      const key = String(dayId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Process a single item (no TTS skip logic here — handled by startGeneration)
  const processItem = useCallback(
    async (item: GeneratableItem): Promise<{ status: 'success' | 'failed' | 'skipped'; error?: string }> => {
      // Add to generation queue widget
      const queueId = queueApi?.addItem({
        daily_content_id: item.dayId,
        post_date: item.postDate,
        field: item.field,
        translation_code: item.translationCode,
      });

      try {
        const body: Record<string, unknown> = {
          daily_content_id: item.dayId,
          field: item.field,
        };
        if (item.translationCode) body.translation_code = item.translationCode;

        const res = await fetch('/api/admin/content-production/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const json = await res.json();
          if (queueId) queueApi?.resolveItem(queueId, 'success', undefined, json.log_id);
          // Update only the specific field so the day stays in PendingTab
          if (json.content) onDayUpdate(item.dayId, item.field, item.translationCode, json.content);
          return { status: 'success' };
        } else {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }));
          const errMsg = err.error || `Failed (${res.status})`;
          if (queueId) queueApi?.resolveItem(queueId, 'failed', errMsg);
          return { status: 'failed', error: errMsg };
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Network error';
        if (queueId) queueApi?.resolveItem(queueId, 'failed', errMsg);
        return { status: 'failed', error: errMsg };
      }
    },
    [queueApi, onDayUpdate]
  );

  // Start bulk generation — processes phases in order, items within a phase concurrently
  const startGeneration = useCallback(async () => {
    setRunning(true);
    runningRef.current = true;
    cancelledRef.current = false;

    for (const phase of [1, 2, 3]) {
      if (cancelledRef.current) break;

      const phaseItems = items.filter(
        (item) => item.phase === phase && item.status !== 'success' && item.status !== 'skipped'
      );
      if (phaseItems.length === 0) continue;

      setCurrentPhase(phase);

      // Worker pool: N workers pull from a shared index
      let nextIdx = 0;
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, phaseItems.length) },
        async () => {
          while (!cancelledRef.current) {
            const idx = nextIdx++;
            if (idx >= phaseItems.length) break;

            const item = phaseItems[idx];

            // TTS skip: if the chapter_text for this translation failed, skip TTS
            if (item.field === 'tts' && item.translationCode) {
              const textId = `${item.dayId}_chapter_text_${item.translationCode}`;
              if (resultMapRef.current.get(textId) === 'failed') {
                resultMapRef.current.set(item.id, 'skipped');
                setItems((prev) =>
                  prev.map((it) =>
                    it.id === item.id ? { ...it, status: 'skipped', error: 'Skipped: translation text failed' } : it
                  )
                );
                continue;
              }
            }

            // Mark running
            setItems((prev) =>
              prev.map((it) => (it.id === item.id ? { ...it, status: 'running' as ItemStatus } : it))
            );
            setActiveCount((c) => c + 1);

            const result = await processItem(item);

            // Record result for cross-phase checks
            resultMapRef.current.set(item.id, result.status);

            // Update UI
            setItems((prev) =>
              prev.map((it) =>
                it.id === item.id ? { ...it, status: result.status, error: result.error } : it
              )
            );
            setActiveCount((c) => c - 1);
          }
        }
      );

      await Promise.all(workers);
    }

    setRunning(false);
    runningRef.current = false;
    setActiveCount(0);
    setCurrentPhase(0);
    onComplete(); // refresh data
  }, [items, processItem, onComplete]);

  const stopGeneration = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const formatDate = (postDate: string) =>
    new Date(postDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const statusIcon = (status: ItemStatus) => {
    switch (status) {
      case 'pending':
        return <div className="h-3 w-3 rounded-full border-2 border-slate-300 dark:border-slate-600" />;
      case 'running':
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
      case 'success':
        return <Check className="h-3.5 w-3.5 text-green-500" />;
      case 'failed':
        return <X className="h-3.5 w-3.5 text-red-500" />;
      case 'skipped':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  const phaseName = (phase: number) => {
    switch (phase) {
      case 1: return 'Content Fields';
      case 2: return 'Translation Text';
      case 3: return 'Audio (TTS)';
      default: return '';
    }
  };

  const progressPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <Modal isOpen={isOpen} onClose={running ? () => {} : onClose} title="Regenerate All Missing" size="lg">
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-medium text-text dark:text-text-dark">
              {stats.total} items
            </span>
            <span className="text-text-muted dark:text-text-muted-dark">
              across {dayGroups.length} days
            </span>
          </div>
          {stats.completed > 0 && (
            <div className="flex items-center gap-3 text-xs">
              {stats.success > 0 && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" /> {stats.success}
                </span>
              )}
              {stats.failed > 0 && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <X className="h-3 w-3" /> {stats.failed}
                </span>
              )}
              {stats.skipped > 0 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" /> {stats.skipped}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {running || stats.completed > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted dark:text-text-muted-dark">
                {running ? 'Processing...' : 'Complete'}
              </span>
              <span className="font-medium text-text dark:text-text-dark">
                {stats.completed}/{stats.total} ({progressPct}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  stats.failed > 0
                    ? 'bg-gradient-to-r from-green-500 to-amber-500'
                    : 'bg-green-500'
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {/* Current phase / concurrency indicator */}
            {running && currentPhase > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 dark:bg-blue-950/30">
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                <span className="text-xs text-blue-700 dark:text-blue-300">
                  Phase {currentPhase}: {phaseName(currentPhase)} — {activeCount} running concurrently
                </span>
              </div>
            )}
          </div>
        ) : null}

        {/* Items list grouped by day */}
        <div className="max-h-96 overflow-y-auto rounded-lg border border-border dark:border-border-dark">
          {dayGroups.map((group) => {
            const collapsed = collapsedDays.has(String(group.dayId));
            const daySuccess = group.items.filter((i) => i.status === 'success').length;
            const dayFailed = group.items.filter((i) => i.status === 'failed').length;
            const dayTotal = group.items.length;

            return (
              <div key={group.dayId} className="border-b border-border/50 last:border-0 dark:border-border-dark/50">
                <button
                  type="button"
                  onClick={() => toggleDay(group.dayId)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover/50 dark:hover:bg-surface-hover-dark/50"
                >
                  {collapsed ? (
                    <ChevronRight className="h-3 w-3 text-text-muted dark:text-text-muted-dark" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-text-muted dark:text-text-muted-dark" />
                  )}
                  <span className="text-xs font-medium text-text dark:text-text-dark">
                    {formatDate(group.postDate)}
                  </span>
                  <span className="ml-auto text-[10px] text-text-muted dark:text-text-muted-dark">
                    {daySuccess > 0 && (
                      <span className="text-green-600 dark:text-green-400">{daySuccess}</span>
                    )}
                    {dayFailed > 0 && (
                      <span className="ml-1 text-red-600 dark:text-red-400">{dayFailed}</span>
                    )}
                    {' '}/{dayTotal}
                  </span>
                </button>

                {!collapsed && (
                  <div className="pb-1">
                    {/* Group by phase within each day */}
                    {[1, 2, 3].map((phase) => {
                      const phaseItems = group.items.filter((i) => i.phase === phase);
                      if (phaseItems.length === 0) return null;
                      return (
                        <div key={phase}>
                          <div className="px-8 py-0.5">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted/60 dark:text-text-muted-dark/60">
                              {phaseName(phase)}
                            </span>
                          </div>
                          {phaseItems.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                'flex items-center gap-2 px-8 py-1',
                                item.status === 'running' && 'bg-blue-50/50 dark:bg-blue-950/20',
                                item.status === 'failed' && 'bg-red-50/30 dark:bg-red-950/10'
                              )}
                            >
                              {statusIcon(item.status)}
                              <span className="text-xs text-text dark:text-text-dark">
                                {item.label}
                              </span>
                              {item.error && (
                                <span
                                  className="ml-auto max-w-[200px] truncate text-[10px] text-red-500"
                                  title={item.error}
                                >
                                  {item.error}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          {!running ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={startGeneration}
                disabled={stats.pending === 0}
              >
                <Play className="h-4 w-4" />
                {stats.completed > 0 ? 'Resume' : 'Start'} Generation
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs text-text-muted dark:text-text-muted-dark">
                Do not close this tab while generating
              </span>
              <Button variant="outline" onClick={stopGeneration}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
