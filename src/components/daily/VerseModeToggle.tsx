'use client';

import { cn } from '@/lib/utils/cn';

export type VerseMode = 'daily_verse' | 'verse_by_category';

interface VerseModeToggleProps {
  mode: VerseMode;
  onChange: (mode: VerseMode) => void;
}

const MODE_LABELS: Record<VerseMode, string> = {
  daily_verse: 'DV',
  verse_by_category: 'VC',
};

const MODE_OPTIONS: { value: VerseMode; short: string; label: string }[] = [
  { value: 'daily_verse', short: 'DV', label: 'Daily Verse' },
  { value: 'verse_by_category', short: 'VC', label: 'Verse by Category' },
];

export function VerseModeToggle({ mode, onChange }: VerseModeToggleProps) {
  return (
    <div data-tutorial="verse-toggle" className="relative">
      <button
        type="button"
        onClick={() => {
          const next = mode === 'daily_verse' ? 'verse_by_category' : 'daily_verse';
          onChange(next);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/15 text-[10px] font-bold tracking-tight text-white backdrop-blur-md transition-colors hover:bg-white/25"
        aria-label={`Verse mode: ${mode === 'daily_verse' ? 'Daily Verse' : 'Verse by Category'}. Tap to switch.`}
        title={mode === 'daily_verse' ? 'Daily Verse' : 'Verse by Category'}
      >
        {MODE_LABELS[mode]}
      </button>
    </div>
  );
}
