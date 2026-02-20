'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { MonthSelector } from './MonthSelector';
import { StatsHeader, type ContentStats } from './StatsHeader';
import { UnassignedTab } from './UnassignedTab';
import { AssignedTab } from './AssignedTab';
import { PendingTab } from './PendingTab';
import { CompletedTab } from './CompletedTab';

import { CreatorManager } from './CreatorManager';
import PlatformSettingsSection from './PlatformSettingsSection';
import { GenerationQueue, type GenerationQueueAPI } from './GenerationQueue';
import { ReviewMonthTab } from './ReviewMonthTab';
import type { DayData, DayTranslation } from './DayCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'unassigned' | 'assigned' | 'pending' | 'completed' | 'review';

interface Creator {
  id: number;
  name: string;
  user_id: number;
  user?: {
    id: number;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
  } | null;
  monthly_capacity: number;
  can_bible: boolean;
  can_positivity: boolean;
  active: boolean;
}

interface MonthData {
  stats: ContentStats;
  days: DayData[];
  creators?: Creator[];
  expectedTranslations?: string[];
}

// ---------------------------------------------------------------------------
// Tabs configuration
// ---------------------------------------------------------------------------

const TABS: { key: TabKey; label: string }[] = [
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'review', label: 'Review Month' },
];

// ---------------------------------------------------------------------------
// Concurrency for bulk generation
// ---------------------------------------------------------------------------

const CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Targeted in-place update helper: only update the specific field that was
 * regenerated, leaving all other flags untouched. This prevents a day from
 * accidentally vanishing from PendingTab due to data shape mismatches.
 */
function applyTargetedUpdate(
  day: DayData,
  field: string,
  translationCode: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: Record<string, any>
): DayData {
  const updated = { ...day };

  switch (field) {
    case 'camera_script':
      updated.has_camera_script = true;
      break;
    case 'devotional_reflection':
      updated.has_devotional = true;
      break;
    case 'meditation_script':
      updated.has_meditation = true;
      if (content?.meditation_script) {
        updated.meditation_script = content.meditation_script;
      }
      break;
    case 'meditation_audio':
      updated.has_meditation_audio = true;
      if (content?.meditation_audio_url) {
        updated.meditation_audio_url = content.meditation_audio_url;
      }
      break;
    case 'background_prompt':
      updated.has_background_prompt = true;
      break;
    case 'chapter_text':
    case 'tts':
    case 'srt': {
      // Update only the specific translation from the API response
      if (translationCode && Array.isArray(content?.translations)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apiT = (content.translations as any[]).find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (t: any) => t.translation_code === translationCode
        );
        if (apiT) {
          const newT: DayTranslation = {
            translation_code: translationCode,
            has_translated_text: Boolean(apiT.translated_text),
            has_audio: Boolean(apiT.audio_url),
            has_srt: Boolean(apiT.audio_srt_url),
            has_chapter_text: Boolean(apiT.chapter_text),
            audio_url: apiT.audio_url || null,
          };
          const idx = updated.translations.findIndex(
            (t) => t.translation_code === translationCode
          );
          if (idx >= 0) {
            updated.translations = [
              ...updated.translations.slice(0, idx),
              newT,
              ...updated.translations.slice(idx + 1),
            ];
          } else {
            updated.translations = [...updated.translations, newT];
          }
        }
      }
      break;
    }
  }

  return updated;
}

/**
 * Build the ordered list of all missing generatable items, grouped by phase.
 * Phase 1: content fields (camera_script, meditation, bg_prompt)
 * Phase 2: translation text (chapter_text for each translation) + meditation audio
 * Phase 3: TTS audio (requires chapter_text to exist)
 * Phase 4: HeyGen video (AI creators with missing lumashort_video_url)
 */
interface BulkItem {
  dayId: number;
  postDate: string;
  field: string;
  translationCode?: string;
  phase: number;
}

function buildMissingItems(
  days: DayData[],
  mode: 'bible' | 'positivity',
  expectedTranslations: string[]
): BulkItem[] {
  const items: BulkItem[] = [];

  for (const day of days) {
    if (day.status === 'empty') continue;

    // Phase 1: Content-level fields
    if (!day.has_camera_script) {
      items.push({ dayId: day.id, postDate: day.post_date, field: 'camera_script', phase: 1 });
    }
    if (mode === 'positivity' && !day.has_meditation) {
      items.push({ dayId: day.id, postDate: day.post_date, field: 'meditation_script', phase: 1 });
    }
    if (mode === 'positivity' && day.has_meditation && !day.has_meditation_audio) {
      items.push({ dayId: day.id, postDate: day.post_date, field: 'meditation_audio', phase: 2 });
    }
    if (!day.has_background_prompt) {
      items.push({ dayId: day.id, postDate: day.post_date, field: 'background_prompt', phase: 1 });
    }

    // Phase 2 & 3: Translation-level fields (bible mode only)
    if (mode === 'bible') {
      const existing = new Map(day.translations.map((t) => [t.translation_code, t]));

      for (const code of expectedTranslations) {
        const t = existing.get(code);

        // Phase 2: Missing translation/chapter text
        if (!t || !t.has_translated_text || !t.has_chapter_text) {
          items.push({ dayId: day.id, postDate: day.post_date, field: 'chapter_text', translationCode: code, phase: 2 });
        }

        // Phase 3: Missing TTS
        if (!t || !t.has_audio || !t.has_srt) {
          items.push({ dayId: day.id, postDate: day.post_date, field: 'tts', translationCode: code, phase: 3 });
        }
      }
    }

    // Phase 4: HeyGen video for AI creators missing lumashort_video_url
    if (
      !day.has_lumashort_video &&
      day.creator?.is_ai &&
      day.creator?.heygen_avatar_id
    ) {
      items.push({ dayId: day.id, postDate: day.post_date, field: 'heygen_video', phase: 4 });
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
// Main component
// ---------------------------------------------------------------------------

export default function ContentProductionPage() {
  const toast = useToast();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [selectedMode, setSelectedMode] = useState<'bible' | 'positivity'>('bible');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [activeTab, setActiveTab] = useState<TabKey>('unassigned');

  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showCreators, setShowCreators] = useState(false);

  // Bulk generation state
  const bulkRunningRef = useRef(false);
  const bulkCancelledRef = useRef(false);

  // Generation queue
  const queueApiRef = useRef<GenerationQueueAPI | null>(null);
  const setQueueApi = useCallback((api: GenerationQueueAPI) => {
    queueApiRef.current = api;
  }, []);

  // Fetch month overview
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: selectedMonth,
        mode: selectedMode,
        language: selectedLanguage,
      });
      const res = await fetch(`/api/admin/content-production?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? json);
      } else {
        toast.error('Failed to load content production data');
        setData(null);
      }
    } catch {
      toast.error('Failed to load content production data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedMode, selectedLanguage, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Update a single field on a day row without a full refetch.
   * Only flips the specific flag that was regenerated — all other flags stay
   * untouched so the day doesn't vanish from PendingTab prematurely.
   */
  const updateDayInPlace = useCallback(
    (
      dayId: number,
      field: string,
      translationCode: string | undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: Record<string, any>
    ) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) =>
            d.id === dayId ? applyTargetedUpdate(d, field, translationCode, content) : d
          ),
        };
      });
    },
    []
  );

  // Handle field regeneration (single item)
  const handleRegenerate = useCallback(
    async (dayId: number, field: string, translationCode?: string) => {
      const label = translationCode ? `${translationCode} ${field.replace(/_/g, ' ')}` : field.replace(/_/g, ' ');

      // Find the post_date for this dayId from current data
      const dayItem = data?.days?.find((d) => d.id === dayId);
      const postDate = dayItem?.post_date ?? '';

      // Add to generation queue
      const queueId = queueApiRef.current?.addItem({
        daily_content_id: dayId,
        post_date: postDate,
        field,
        translation_code: translationCode,
        mode: selectedMode,
        language: selectedLanguage,
      });

      try {
        const body: Record<string, unknown> = { daily_content_id: dayId, field };
        if (translationCode) body.translation_code = translationCode;

        const res = await fetch('/api/admin/content-production/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const json = await res.json();
          toast.success(`Regenerated ${label}`);
          if (queueId) queueApiRef.current?.resolveItem(queueId, 'success', undefined, json.log_id);
          // Update only the specific field in-place
          if (json.content) updateDayInPlace(dayId, field, translationCode, json.content);
        } else {
          const err = await res.json();
          const errMsg = err.error || `Failed to regenerate ${label}`;
          toast.error(errMsg);
          if (queueId) queueApiRef.current?.resolveItem(queueId, 'failed', errMsg);
        }
      } catch {
        const errMsg = `Failed to regenerate ${label}`;
        toast.error(errMsg);
        if (queueId) queueApiRef.current?.resolveItem(queueId, 'failed', errMsg);
      }
    },
    [toast, data?.days, updateDayInPlace]
  );

  // Handle background video upload for a specific day
  const handleVideoUpload = useCallback(
    async (dayId: number, postDate: string, file: File) => {
      try {
        // Get presigned URL
        const presignRes = await fetch(
          `/api/upload/presigned?type=daily-content&contentType=${encodeURIComponent(file.type)}`,
          { credentials: 'include' }
        );
        if (!presignRes.ok) throw new Error('Failed to get upload URL');
        const { uploadUrl, publicUrl } = await presignRes.json();

        // Upload to B2
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!uploadRes.ok) throw new Error('Upload to storage failed');

        // Link video to daily content
        const linkRes = await fetch('/api/admin/content-production/background-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ uploads: [{ date: postDate, video_url: publicUrl }] }),
        });
        if (!linkRes.ok) {
          const err = await linkRes.json();
          throw new Error(err.error || 'Failed to link video');
        }

        // Update the day in-place
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            days: prev.days.map((d) =>
              d.id === dayId ? { ...d, has_background_video: true } : d
            ),
          };
        });

        toast.success('Background video uploaded');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [toast]
  );

  // Handle HeyGen AI video generation for a single day
  const handleGenerateHeygenVideo = useCallback(
    async (dayId: number, postDate: string) => {
      // Add to generation queue
      const queueId = queueApiRef.current?.addItem({
        daily_content_id: dayId,
        post_date: postDate,
        field: 'heygen_video',
        mode: selectedMode,
        language: selectedLanguage,
      });

      try {
        const res = await fetch('/api/admin/content-production/heygen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            month: selectedMonth,
            mode: selectedMode,
            daily_content_id: dayId,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const respData = json.data ?? json;
          if (respData.triggered > 0) {
            toast.success(`HeyGen video triggered for ${postDate}`);
            // Keep as running — webhook will complete it via log polling
          } else {
            const errMsg = respData.errors?.[0]?.error || 'No video was triggered — check creator assignment';
            toast.error(errMsg);
            if (queueId) queueApiRef.current?.resolveItem(queueId, 'failed', errMsg);
          }
        } else {
          const err = await res.json().catch(() => ({ error: 'Request failed' }));
          const errMsg = err.error || 'Failed to trigger HeyGen video';
          toast.error(errMsg);
          if (queueId) queueApiRef.current?.resolveItem(queueId, 'failed', errMsg);
        }
      } catch {
        const errMsg = 'Failed to trigger HeyGen video';
        toast.error(errMsg);
        if (queueId) queueApiRef.current?.resolveItem(queueId, 'failed', errMsg);
      }
    },
    [selectedMonth, selectedMode, toast]
  );

  // Handle content_text save
  const handleContentTextSave = useCallback(
    async (dayId: number, text: string) => {
      const res = await fetch('/api/admin/content-production/update-text', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ daily_content_id: dayId, content_text: text }),
      });
      if (res.ok) {
        toast.success('Quote text saved');
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            days: prev.days.map((d) =>
              d.id === dayId ? { ...d, content_text: text } : d
            ),
          };
        });
      } else {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        toast.error(err.error || 'Failed to save quote text');
      }
    },
    [toast]
  );

  /**
   * Bulk regenerate all missing items. Adds everything to the generation queue
   * in dependency order (content fields → translation text → TTS) and processes
   * them with a worker pool per phase.
   */
  const handleBulkRegenerate = useCallback(async () => {
    if (bulkRunningRef.current) {
      toast.error('Bulk generation is already running');
      return;
    }

    const days = data?.days ?? [];
    const expectedTranslations = data?.expectedTranslations ?? [];
    const items = buildMissingItems(days, selectedMode, expectedTranslations);

    if (items.length === 0) {
      toast.success('Nothing to regenerate — all fields are filled');
      return;
    }

    const queueApi = queueApiRef.current;
    if (!queueApi) {
      toast.error('Generation queue not ready');
      return;
    }

    // Add all items to the queue as 'queued'
    const queueIds = queueApi.bulkAddItems(
      items.map((item) => ({
        daily_content_id: item.dayId,
        post_date: item.postDate,
        field: item.field,
        translation_code: item.translationCode,
        mode: selectedMode,
        language: selectedLanguage,
      }))
    );

    toast.success(`Queued ${items.length} items for generation`);

    bulkRunningRef.current = true;
    bulkCancelledRef.current = false;

    // Track results for dependency checks (TTS skips if chapter_text failed)
    const resultMap = new Map<string, 'success' | 'failed'>();

    // Process by phase, concurrent within each phase
    for (const phase of [1, 2, 3, 4]) {
      if (bulkCancelledRef.current) break;

      const phaseItems = items
        .map((item, i) => ({ item, queueId: queueIds[i] }))
        .filter(({ item }) => item.phase === phase);

      if (phaseItems.length === 0) continue;

      // Worker pool: N workers pull from a shared index
      let nextIdx = 0;
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, phaseItems.length) },
        async () => {
          while (!bulkCancelledRef.current) {
            const idx = nextIdx++;
            if (idx >= phaseItems.length) break;

            const { item, queueId } = phaseItems[idx];

            // TTS skip: if chapter_text for this translation failed, skip TTS
            if (item.field === 'tts' && item.translationCode) {
              const textKey = `${item.dayId}_chapter_text_${item.translationCode}`;
              if (resultMap.get(textKey) === 'failed') {
                queueApi.resolveItem(queueId, 'failed', 'Skipped: translation text failed');
                resultMap.set(`${item.dayId}_${item.field}_${item.translationCode}`, 'failed');
                continue;
              }
            }

            // Mark as running
            queueApi.setItemRunning(queueId);

            try {
              // HeyGen videos use a different API endpoint
              if (item.field === 'heygen_video') {
                const res = await fetch('/api/admin/content-production/heygen', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    month: item.postDate.slice(0, 7),
                    mode: selectedMode,
                    daily_content_id: item.dayId,
                  }),
                });

                if (res.ok) {
                  const json = await res.json();
                  const respData = json.data ?? json;
                  if (respData.triggered > 0) {
                    // HeyGen is async — leave as 'running'; webhook will complete it
                    resultMap.set(`${item.dayId}_heygen_video`, 'success');
                  } else {
                    const errMsg = respData.errors?.[0]?.error || 'No video triggered';
                    queueApi.resolveItem(queueId, 'failed', errMsg);
                    resultMap.set(`${item.dayId}_heygen_video`, 'failed');
                  }
                } else {
                  const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                  const errMsg = err.error || `Failed (${res.status})`;
                  queueApi.resolveItem(queueId, 'failed', errMsg);
                  resultMap.set(`${item.dayId}_heygen_video`, 'failed');
                }
              } else {
                // Standard regenerate endpoint for all other fields
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
                  queueApi.resolveItem(queueId, 'success', undefined, json.log_id);
                  if (json.content) updateDayInPlace(item.dayId, item.field, item.translationCode, json.content);
                  const key = item.translationCode
                    ? `${item.dayId}_${item.field}_${item.translationCode}`
                    : `${item.dayId}_${item.field}`;
                  resultMap.set(key, 'success');
                } else {
                  const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                  const errMsg = err.error || `Failed (${res.status})`;
                  queueApi.resolveItem(queueId, 'failed', errMsg);
                  const key = item.translationCode
                    ? `${item.dayId}_${item.field}_${item.translationCode}`
                    : `${item.dayId}_${item.field}`;
                  resultMap.set(key, 'failed');
                }
              }
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : 'Network error';
              queueApi.resolveItem(queueId, 'failed', errMsg);
              const key = item.translationCode
                ? `${item.dayId}_${item.field}_${item.translationCode}`
                : `${item.dayId}_${item.field}`;
              resultMap.set(key, 'failed');
            }
          }
        }
      );

      await Promise.all(workers);
    }

    bulkRunningRef.current = false;
    // Refresh data to pick up all changes
    fetchData();
  }, [data?.days, data?.expectedTranslations, selectedMode, toast, updateDayInPlace, fetchData]);

  const creators = data?.creators ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text-dark">
            Content Production
          </h1>
          <p className="text-text-muted dark:text-text-muted-dark">
            Manage daily content generation, creator assignments, and approvals
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCreators(true)}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-surface-hover-dark"
            title="Manage Creators"
          >
            <Users className="h-4 w-4" />
            Creators
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-surface-hover-dark"
            title="Pipeline Settings"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Controls: month selector + mode toggle + language toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <MonthSelector month={selectedMonth} onChange={setSelectedMonth} />

        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
            {(['bible', 'positivity'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors',
                  selectedMode === mode
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex gap-1 rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
            {([
              { code: 'en', label: 'EN' },
              { code: 'es', label: 'ES' },
            ] as const).map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.code)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  selectedLanguage === lang.code
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats header */}
      <StatsHeader stats={data?.stats ?? null} loading={loading} />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === t.key
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {activeTab === 'unassigned' && (
            <UnassignedTab
              days={data?.days ?? []}
              month={selectedMonth}
              mode={selectedMode}
              language={selectedLanguage}
              creators={creators}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'assigned' && (
            <AssignedTab
              days={data?.days ?? []}
              month={selectedMonth}
              mode={selectedMode}
              creators={creators}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'pending' && (
            <PendingTab
              days={data?.days ?? []}
              mode={selectedMode}
              expectedTranslations={data?.expectedTranslations ?? []}
              creators={creators}
              onRegenerate={handleRegenerate}
              onBulkGenerate={handleBulkRegenerate}
              onRefresh={fetchData}
              onVideoUpload={handleVideoUpload}
              onGenerateHeygenVideo={handleGenerateHeygenVideo}
              onContentTextSave={handleContentTextSave}
            />
          )}
          {activeTab === 'completed' && (
            <CompletedTab
              days={data?.days ?? []}
              mode={selectedMode}
              expectedTranslations={data?.expectedTranslations ?? []}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'review' && (
            <ReviewMonthTab
              month={selectedMonth}
              mode={selectedMode}
              language={selectedLanguage}
            />
          )}
        </>
      )}

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Pipeline Settings"
        size="lg"
      >
        <PlatformSettingsSection />
      </Modal>

      {/* Creators Modal */}
      <Modal
        isOpen={showCreators}
        onClose={() => setShowCreators(false)}
        title="Content Creators"
        size="xl"
      >
        <CreatorManager onCreatorChange={fetchData} />
      </Modal>

      {/* Persistent generation queue */}
      <GenerationQueue onRef={setQueueApi} />
    </div>
  );
}
