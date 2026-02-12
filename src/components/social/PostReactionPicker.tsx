'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import {
  REACTION_TYPES,
  REACTION_EMOJI_MAP,
  REACTION_LABELS,
} from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';

interface PostReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  counts: Record<string, number>;
  userReaction: ReactionType | null;
  onSelect: (type: ReactionType) => void;
}

export function PostReactionPicker({
  isOpen,
  onClose,
  counts,
  userReaction,
  onSelect,
}: PostReactionPickerProps) {
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
      <div className="relative z-10 w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800">
        <h3 className="mb-3 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
          React
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {REACTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleSelect(type)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl p-3 transition-all active:scale-90',
                userReaction === type
                  ? 'bg-indigo-100 ring-2 ring-indigo-400 dark:bg-indigo-500/25 dark:ring-indigo-400/60'
                  : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700'
              )}
            >
              <span className="text-2xl">{REACTION_EMOJI_MAP[type]}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{REACTION_LABELS[type]}</span>
              {(counts[type] || 0) > 0 && (
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
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
