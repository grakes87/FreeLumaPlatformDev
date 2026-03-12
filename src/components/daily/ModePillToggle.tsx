'use client';

import { cn } from '@/lib/utils/cn';
import { useViewMode } from '@/context/ViewModeContext';

export function ModePillToggle() {
  const { effectiveMode, isBothMode, setViewMode } = useViewMode();

  if (!isBothMode) return null;

  return (
    <div className="flex rounded-full border border-white/25 bg-white/15 backdrop-blur-md overflow-hidden">
      <button
        type="button"
        onClick={() => setViewMode('bible')}
        className={cn(
          'px-4 py-1.5 text-xs font-semibold transition-colors',
          effectiveMode === 'bible'
            ? 'bg-white text-black'
            : 'text-white/80 hover:text-white'
        )}
      >
        Bible
      </button>
      <button
        type="button"
        onClick={() => setViewMode('positivity')}
        className={cn(
          'px-4 py-1.5 text-xs font-semibold transition-colors',
          effectiveMode === 'positivity'
            ? 'bg-white text-black'
            : 'text-white/80 hover:text-white'
        )}
      >
        Positivity
      </button>
    </div>
  );
}
