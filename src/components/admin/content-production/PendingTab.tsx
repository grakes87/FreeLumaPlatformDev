'use client';

import { useMemo } from 'react';
import { AlertTriangle, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DayCard, type DayData } from './DayCard';

interface PendingTabProps {
  days: DayData[];
  mode: 'bible' | 'positivity';
  expectedTranslations: string[];
  onRegenerate: (dayId: number, field: string, translationCode?: string) => void;
  onBulkGenerate: () => void;
  onVideoUpload?: (dayId: number, postDate: string, file: File) => void | Promise<void>;
  onGenerateHeygenVideo?: (dayId: number, postDate: string) => void | Promise<void>;
  onContentTextSave?: (dayId: number, text: string) => void | Promise<void>;
}

interface MissingField {
  key: string;
  label: string;
}

function getMissingFields(
  day: DayData,
  mode: 'bible' | 'positivity',
  expectedTranslations: string[]
): MissingField[] {
  const missing: MissingField[] = [];
  if (!day.has_camera_script) missing.push({ key: 'camera_script', label: 'Script' });
  if (mode === 'positivity' && !day.has_meditation) missing.push({ key: 'meditation_script', label: 'Meditation Script' });
  if (mode === 'positivity' && day.has_meditation && !day.has_meditation_audio) missing.push({ key: 'meditation_audio', label: 'Meditation Audio' });
  if (!day.has_background_prompt) missing.push({ key: 'background_prompt', label: 'BG Prompt' });
  if (!day.has_background_video) missing.push({ key: 'background_video', label: 'BG Video' });
  if (!day.has_lumashort_video) missing.push({ key: 'lumashort_video', label: 'Video' });

  if (mode === 'bible') {
    // Build a map of existing translations for quick lookup
    const existing = new Map(
      day.translations.map((t) => [t.translation_code, t])
    );

    // Count each translation with ANY missing data as one item
    for (const code of expectedTranslations) {
      const t = existing.get(code);
      if (!t) {
        missing.push({ key: `translation_${code}`, label: `${code}` });
      } else if (!t.has_translated_text || !t.has_audio || !t.has_srt || !t.has_chapter_text) {
        const parts = [
          !t.has_translated_text && 'text',
          !t.has_audio && 'audio',
          !t.has_srt && 'srt',
          !t.has_chapter_text && 'chapter',
        ].filter(Boolean).join(',');
        missing.push({ key: `translation_${code}`, label: `${code} (${parts})` });
      }
    }
  }

  return missing;
}

export function PendingTab({ days, mode, expectedTranslations, onRegenerate, onBulkGenerate, onVideoUpload, onGenerateHeygenVideo, onContentTextSave }: PendingTabProps) {
  const pendingDays = useMemo(() => {
    return days
      .filter((d) => d.status !== 'empty' && getMissingFields(d, mode, expectedTranslations).length > 0)
      .sort((a, b) => a.post_date.localeCompare(b.post_date));
  }, [days, mode, expectedTranslations]);

  const totalMissing = useMemo(() => {
    return pendingDays.reduce(
      (sum, d) => sum + getMissingFields(d, mode, expectedTranslations).length,
      0
    );
  }, [pendingDays, mode, expectedTranslations]);

  if (pendingDays.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
        <AlertTriangle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium text-text dark:text-text-dark">
          No pending content
        </p>
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          All generated content has complete fields. Nice work!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          {pendingDays.length} day{pendingDays.length !== 1 ? 's' : ''} with missing fields
          <span className="ml-1 text-text-muted/70">({totalMissing} total items)</span>
        </p>
        <Button onClick={onBulkGenerate}>
          <Zap className="h-4 w-4" />
          Regenerate All Missing
        </Button>
      </div>

      <div className="space-y-2">
        {pendingDays.map((day) => {
          const missing = getMissingFields(day, mode, expectedTranslations);

          return (
            <div key={day.id} className="space-y-0">
              {/* Missing label row */}
              <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-border bg-red-50/50 px-4 py-2 dark:border-border-dark dark:bg-red-900/10">
                <X className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-medium text-red-700 dark:text-red-400">
                  Missing content ({missing.length} field{missing.length !== 1 ? 's' : ''})
                </span>
              </div>
              {/* Expandable DayCard with regenerate */}
              <div className="[&>div]:rounded-t-none">
                <DayCard day={day} mode={mode} expectedTranslations={expectedTranslations} onRegenerate={onRegenerate} onVideoUpload={onVideoUpload} onGenerateHeygenVideo={onGenerateHeygenVideo} onContentTextSave={onContentTextSave} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
