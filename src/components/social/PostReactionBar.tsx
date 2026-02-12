'use client';

import { REACTION_EMOJI_MAP } from '@/lib/utils/constants';
import type { ReactionType } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';

interface PostReactionBarProps {
  counts: Record<string, number>;
  total: number;
  userReaction: ReactionType | null;
  onOpenPicker: () => void;
}

export function PostReactionBar({
  counts,
  total,
  userReaction,
  onOpenPicker,
}: PostReactionBarProps) {
  // Sort reaction types by count descending, take top 3
  const sortedTypes = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type as ReactionType);

  const topEmojis = sortedTypes.slice(0, 3);

  if (total === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpenPicker}
      className={cn(
        'flex items-center gap-1.5 transition-all active:scale-95',
        userReaction && 'rounded-full bg-indigo-50 px-2 py-0.5 dark:bg-indigo-500/15'
      )}
    >
      {/* Overlapping emojis — Meta style */}
      <div className="flex items-center">
        {topEmojis.map((type, i) => (
          <span
            key={type}
            className="relative flex h-[18px] w-[18px] items-center justify-center text-sm leading-none"
            style={{ marginLeft: i > 0 ? -5 : 0, zIndex: topEmojis.length - i }}
          >
            {REACTION_EMOJI_MAP[type]}
          </span>
        ))}
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
        {total}
      </span>
    </button>
  );
}
