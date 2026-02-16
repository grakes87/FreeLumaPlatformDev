'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import {
  DAILY_REACTION_TYPES,
  REACTION_EMOJI_MAP,
  REACTION_LABELS,
} from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';

interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  counts: Record<string, number>;
  userReaction: ReactionType | null;
  onSelect: (type: ReactionType) => void;
}

export function ReactionPicker({
  isOpen,
  onClose,
  counts,
  userReaction,
  onSelect,
}: ReactionPickerProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleSelect = (type: ReactionType) => {
    onSelect(type);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Picker panel */}
      <div className="relative z-10 w-full max-w-xs rounded-2xl bg-white/10 p-4 backdrop-blur-xl">
        <h3 className="mb-3 text-center text-sm font-semibold text-white/80">
          React
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {DAILY_REACTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleSelect(type)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl p-3 transition-all active:scale-90',
                userReaction === type
                  ? 'bg-white/25 ring-2 ring-white/50'
                  : 'bg-white/5 hover:bg-white/15'
              )}
            >
              <span className="text-2xl">{REACTION_EMOJI_MAP[type]}</span>
              <span className="text-xs text-white/70">{REACTION_LABELS[type]}</span>
              {(counts[type] || 0) > 0 && (
                <span className="text-xs font-semibold text-white/90">
                  {counts[type]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
