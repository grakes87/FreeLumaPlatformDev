'use client';

import { cn } from '@/lib/utils/cn';

interface TranslationSwitcherProps {
  translations: string[];
  activeTranslation: string | null;
  onSwitch: (code: string) => void;
  mode: 'bible' | 'positivity';
}

const TRANSLATION_LABELS: Record<string, string> = {
  KJV: 'KJV',
  NIV: 'NIV',
  NRSV: 'NRSV',
  NAB: 'NAB',
};

export function TranslationSwitcher({
  translations,
  activeTranslation,
  onSwitch,
  mode,
}: TranslationSwitcherProps) {
  // Only visible for Bible mode (positivity quotes don't have translations)
  if (mode !== 'bible' || translations.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      {translations.map((code) => {
        const isActive = code === activeTranslation;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onSwitch(code)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-all duration-200',
              isActive
                ? 'bg-white/90 text-gray-900 shadow-sm'
                : 'bg-white/20 text-white/80 hover:bg-white/30 hover:text-white'
            )}
            aria-pressed={isActive}
            aria-label={`Switch to ${TRANSLATION_LABELS[code] || code} translation`}
          >
            {TRANSLATION_LABELS[code] || code}
          </button>
        );
      })}
    </div>
  );
}
