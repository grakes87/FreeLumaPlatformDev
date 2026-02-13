'use client';

import { cn } from '@/lib/utils/cn';
import { REACTION_TYPES, REACTION_EMOJI_MAP } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';

interface MessageReactionPickerProps {
  onSelect: (type: ReactionType) => void;
  className?: string;
}

/**
 * Horizontal row of 6 emoji reactions for chat messages.
 * Appears above the message context menu.
 */
export function MessageReactionPicker({ onSelect, className }: MessageReactionPickerProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-2xl px-2 py-1.5',
        'border border-white/15 shadow-lg',
        className
      )}
    >
      {REACTION_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className="rounded-full p-1.5 text-xl transition-transform active:scale-125 hover:bg-white/10"
          aria-label={type}
        >
          {REACTION_EMOJI_MAP[type]}
        </button>
      ))}
    </div>
  );
}
