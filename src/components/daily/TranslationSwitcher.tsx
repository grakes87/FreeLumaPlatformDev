'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TranslationSwitcherProps {
  translations: string[];
  translationNames: Record<string, string>;
  activeTranslation: string | null;
  onSwitch: (code: string) => void;
  mode: 'bible' | 'positivity';
}

export function TranslationSwitcher({
  translations,
  translationNames,
  activeTranslation,
  onSwitch,
  mode,
}: TranslationSwitcherProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  // Position dropdown relative to trigger
  useEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (mode !== 'bible' || translations.length === 0) {
    return null;
  }

  const activeName = activeTranslation
    ? translationNames[activeTranslation] || activeTranslation
    : '';

  const dropdown = open
    ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-64 overflow-hidden rounded-2xl"
          style={{
            top: pos.top,
            left: pos.left,
            transform: 'translateX(-50%)',
            backdropFilter: 'blur(8px) saturate(160%)',
            WebkitBackdropFilter: 'blur(8px) saturate(160%)',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          }}
          role="listbox"
          aria-activedescendant={activeTranslation ?? undefined}
        >
          {translations.map((code, i) => {
            const isActive = code === activeTranslation;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSwitch(code);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors',
                  isActive
                    ? 'text-white font-medium'
                    : 'text-white/85 hover:text-white'
                )}
              >
                <span>{translationNames[code] || code}</span>
                <span className="text-xs text-white/50">{code}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative">
      {/* Trigger button — glass pill */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 py-1.5 pl-4 pr-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-white/20"
        style={{
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select Bible translation"
      >
        {activeName}
        <ChevronDown className={cn('h-4 w-4 text-white/70 transition-transform', open && 'rotate-180')} />
      </button>

      {dropdown}
    </div>
  );
}
