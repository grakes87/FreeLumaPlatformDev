'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { useVideoReactions } from '@/hooks/useVideoReactions';
import { PostReactionBar } from '@/components/social/PostReactionBar';
import { PostReactionPicker } from '@/components/social/PostReactionPicker';
import type { ReactionType } from '@/lib/utils/constants';

interface VideoReactionBarProps {
  videoId: number;
  initialReactionCounts: Record<string, number>;
  initialTotalReactions: number;
  initialUserReaction: ReactionType | null;
}

/**
 * Reaction bar for videos — reuses PostReactionBar display + PostReactionPicker overlay.
 * Uses useVideoReactions hook for video-specific API calls.
 */
export function VideoReactionBar({
  videoId,
  initialReactionCounts,
  initialTotalReactions,
  initialUserReaction,
}: VideoReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false);

  const { counts, total, userReaction, toggleReaction } = useVideoReactions({
    videoId,
    initialCounts: initialReactionCounts,
    initialTotal: initialTotalReactions,
    initialUserReaction: initialUserReaction,
  });

  const handleSelect = (type: ReactionType) => {
    toggleReaction(type);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Reaction summary (overlapping emojis + count) */}
      <PostReactionBar
        counts={counts}
        total={total}
        userReaction={userReaction}
        onOpenPicker={() => setShowPicker(true)}
      />

      {/* Add reaction button when no reactions yet */}
      {total === 0 && (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-all active:scale-95',
            'bg-gray-100 text-gray-600 hover:bg-gray-200',
            'dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15'
          )}
        >
          <span className="text-base">+</span>
          <span className="text-xs font-medium">React</span>
        </button>
      )}

      {/* Reaction picker overlay */}
      <PostReactionPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        counts={counts}
        userReaction={userReaction}
        onSelect={handleSelect}
      />
    </div>
  );
}
