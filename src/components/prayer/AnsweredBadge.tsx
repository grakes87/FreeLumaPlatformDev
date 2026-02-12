'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface AnsweredBadgeProps {
  answeredAt?: string | null;
  className?: string;
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 5) return `${diffWeek}w ago`;
  return `${diffMonth}mo ago`;
}

export function AnsweredBadge({ answeredAt, className }: AnsweredBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700',
        'dark:bg-green-900/30 dark:text-green-400',
        className
      )}
    >
      <Check className="h-3.5 w-3.5" />
      <span>Answered</span>
      {answeredAt && (
        <span className="text-green-600/70 dark:text-green-400/60">
          {getRelativeTime(answeredAt)}
        </span>
      )}
    </div>
  );
}
