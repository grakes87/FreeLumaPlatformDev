'use client';

import { cn } from '@/lib/utils/cn';

export type VerseMode = 'daily_verse' | 'verse_by_category';

interface VerseModeToggleProps {
  mode: VerseMode;
  onChange: (mode: VerseMode) => void;
}

const MODES: { value: VerseMode; label: string }[] = [
  { value: 'daily_verse', label: 'Daily Post' },
  { value: 'verse_by_category', label: 'Verse by Category' },
];

export function VerseModeToggle({ mode, onChange }: VerseModeToggleProps) {
  const activeIndex = MODES.findIndex((m) => m.value === mode);

  return (
    <div className="flex rounded-full bg-white/10 p-1 backdrop-blur-2xl">
      {/* Animated pill indicator */}
      <div className="relative flex w-full">
        {/* Background pill */}
        <div
          className="absolute inset-y-0 rounded-full bg-white/20 transition-all duration-200"
          style={{
            width: `${100 / MODES.length}%`,
            left: `${(activeIndex * 100) / MODES.length}%`,
          }}
        />

        {/* Buttons */}
        {MODES.map((m) => {
          const isActive = m.value === mode;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange(m.value)}
              className={cn(
                'relative z-10 flex-1 rounded-full px-4 py-1.5 text-xs font-medium transition-colors duration-200',
                isActive ? 'text-white' : 'text-white/60'
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
