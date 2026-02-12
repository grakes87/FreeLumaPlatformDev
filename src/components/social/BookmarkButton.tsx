'use client';

import { Bookmark } from 'lucide-react';
import { useBookmark } from '@/hooks/useBookmark';
import { cn } from '@/lib/utils/cn';

interface BookmarkButtonProps {
  postId: number;
  initialBookmarked?: boolean;
  size?: 'sm' | 'md';
}

export function BookmarkButton({
  postId,
  initialBookmarked = false,
  size = 'md',
}: BookmarkButtonProps) {
  const { isBookmarked, loading, toggle } = useBookmark(postId, initialBookmarked);

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark post'}
      className={cn(
        'flex items-center justify-center rounded-full p-2 transition-colors',
        'hover:bg-slate-100 dark:hover:bg-slate-800',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isBookmarked
          ? 'text-amber-500 dark:text-amber-400'
          : 'text-text-muted dark:text-text-muted-dark'
      )}
    >
      <Bookmark
        className={cn(iconSize, isBookmarked && 'fill-current')}
      />
    </button>
  );
}
