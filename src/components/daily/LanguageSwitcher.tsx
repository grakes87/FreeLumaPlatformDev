'use client';

import { cn } from '@/lib/utils/cn';

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
] as const;

interface LanguageSwitcherProps {
  activeLanguage: string;
  onSwitch: (code: string) => void;
}

export function LanguageSwitcher({ activeLanguage, onSwitch }: LanguageSwitcherProps) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-full border border-white/20 shadow-lg"
      style={{
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        background: 'rgba(255, 255, 255, 0.08)',
      }}
      role="radiogroup"
      aria-label="Select language"
    >
      {LANGUAGES.map((lang) => {
        const isActive = activeLanguage === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={lang.label}
            onClick={() => onSwitch(lang.code)}
            className={cn(
              'px-3 py-1.5 text-base transition-colors',
              isActive
                ? 'bg-white/20 shadow-inner'
                : 'hover:bg-white/10 opacity-50'
            )}
          >
            {lang.flag}
          </button>
        );
      })}
    </div>
  );
}
