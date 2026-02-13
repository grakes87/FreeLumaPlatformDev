'use client';

import { cn } from '@/lib/utils/cn';

interface OnlineStatusDotProps {
  isOnline: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Green dot indicator for online presence status.
 * Positioned absolutely on an avatar (parent must be relative).
 * Only renders when isOnline is true.
 */
export function OnlineStatusDot({
  isOnline,
  size = 'sm',
  className,
}: OnlineStatusDotProps) {
  if (!isOnline) return null;

  return (
    <span
      className={cn(
        'absolute bottom-0 right-0 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-900',
        size === 'sm' ? 'h-2 w-2' : 'h-3 w-3',
        className
      )}
      aria-label="Online"
    />
  );
}
