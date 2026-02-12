'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface DateNavigatorProps {
  currentDate: string; // YYYY-MM-DD
  className?: string;
}

/**
 * Format a YYYY-MM-DD date string to a human-readable format.
 * e.g., "February 11, 2026"
 */
function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get the previous day as YYYY-MM-DD.
 */
function getPreviousDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * Get the next day as YYYY-MM-DD.
 */
function getNextDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

/**
 * Get today's date as YYYY-MM-DD in local timezone.
 */
function getTodayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DateNavigator({ currentDate, className }: DateNavigatorProps) {
  const router = useRouter();

  const today = getTodayLocal();
  const isToday = currentDate === today;
  const nextDay = getNextDay(currentDate);
  const canGoForward = nextDay <= today;

  const handlePrevious = () => {
    const prevDay = getPreviousDay(currentDate);
    router.push(`/daily/${prevDay}`);
  };

  const handleNext = () => {
    if (!canGoForward) return;
    // If next day is today, go to home (no date param)
    if (nextDay === today) {
      router.push('/');
    } else {
      router.push(`/daily/${nextDay}`);
    }
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Previous day arrow */}
      <button
        type="button"
        onClick={handlePrevious}
        className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Date display */}
      <span className="min-w-[140px] text-center text-sm font-medium text-white/90 drop-shadow-md">
        {isToday ? 'Today' : formatDisplayDate(currentDate)}
      </span>

      {/* Next day arrow (hidden when at today) */}
      {canGoForward ? (
        <button
          type="button"
          onClick={handleNext}
          className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : (
        // Invisible spacer to keep date centered
        <div className="h-9 w-9" aria-hidden="true" />
      )}
    </div>
  );
}
