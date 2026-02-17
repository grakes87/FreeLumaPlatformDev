'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  RefreshCw,
  User,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';

export interface DayTranslation {
  translation_code: string;
  has_audio: boolean;
  has_srt: boolean;
  has_chapter_text: boolean;
}

export interface DayData {
  id: number;
  post_date: string;
  status: string;
  creator: {
    id: number;
    name: string;
    user_id: number | null;
    user?: {
      id: number;
      avatar_url: string | null;
      avatar_color: string | null;
    } | null;
  } | null;
  title: string | null;
  verse_reference: string | null;
  has_camera_script: boolean;
  has_devotional: boolean;
  has_meditation: boolean;
  has_background_prompt: boolean;
  has_creator_video: boolean;
  translations: DayTranslation[];
}

interface DayCardProps {
  day: DayData;
  mode: 'bible' | 'positivity';
  onRegenerate?: (dayId: number, field: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  empty: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  generated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  assigned: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function FieldBadge({ has, label }: { has: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium',
        has
          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
      )}
    >
      {has ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function DayCard({ day, mode, onRegenerate }: DayCardProps) {
  const [expanded, setExpanded] = useState(false);

  const dateLabel = new Date(day.post_date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const statusClass = STATUS_COLORS[day.status] || STATUS_COLORS.empty;

  return (
    <div className="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Calendar className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
        <span className="min-w-[7rem] text-sm font-medium text-text dark:text-text-dark">
          {dateLabel}
        </span>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusClass)}>
          {day.status}
        </span>
        {day.title && (
          <span className="truncate text-sm text-text-muted dark:text-text-muted-dark">
            {day.title}
          </span>
        )}
        {day.creator && (
          <span className="ml-auto flex items-center gap-1 text-xs text-text-muted dark:text-text-muted-dark">
            <User className="h-3 w-3" />
            {day.creator.name}
          </span>
        )}
        <span className="ml-auto shrink-0 text-text-muted dark:text-text-muted-dark">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 dark:border-border-dark">
          {day.status === 'empty' ? (
            <p className="text-sm italic text-text-muted dark:text-text-muted-dark">
              No content generated for this day.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                    Date
                  </p>
                  <p className="text-text dark:text-text-dark">{day.post_date}</p>
                </div>
                {day.verse_reference && (
                  <div>
                    <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                      Verse
                    </p>
                    <p className="text-text dark:text-text-dark">{day.verse_reference}</p>
                  </div>
                )}
              </div>

              {/* Field completeness */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                  Content Fields
                </p>
                <div className="flex flex-wrap gap-2">
                  <FieldBadge has={day.has_camera_script} label="Camera Script" />
                  {mode === 'bible' && (
                    <FieldBadge has={day.has_devotional} label="Devotional" />
                  )}
                  <FieldBadge has={day.has_meditation} label="Meditation" />
                  <FieldBadge has={day.has_background_prompt} label="BG Prompt" />
                  <FieldBadge has={day.has_creator_video} label="Creator Video" />
                </div>
              </div>

              {/* Regenerate buttons */}
              {onRegenerate && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                    Regenerate Fields
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!day.has_camera_script && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); onRegenerate(day.id, 'camera_script'); }}
                      >
                        <RefreshCw className="h-3 w-3" /> Camera Script
                      </Button>
                    )}
                    {mode === 'bible' && !day.has_devotional && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); onRegenerate(day.id, 'devotional_reflection'); }}
                      >
                        <RefreshCw className="h-3 w-3" /> Devotional
                      </Button>
                    )}
                    {!day.has_meditation && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); onRegenerate(day.id, 'meditation_script'); }}
                      >
                        <RefreshCw className="h-3 w-3" /> Meditation
                      </Button>
                    )}
                    {!day.has_background_prompt && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); onRegenerate(day.id, 'background_prompt'); }}
                      >
                        <RefreshCw className="h-3 w-3" /> BG Prompt
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Translation status */}
              {day.translations.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                    Translations ({day.translations.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {day.translations.map((t) => (
                      <span
                        key={t.translation_code}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium',
                          t.has_audio && t.has_srt && t.has_chapter_text
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}
                      >
                        {t.translation_code}
                        {t.has_audio && t.has_srt && t.has_chapter_text ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <span className="text-[10px]">
                            {[
                              !t.has_audio && 'audio',
                              !t.has_srt && 'srt',
                              !t.has_chapter_text && 'text',
                            ]
                              .filter(Boolean)
                              .join(',')}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
