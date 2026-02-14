'use client';

import { usePrayerToggle } from '@/hooks/usePrayerToggle';
import { cn } from '@/lib/utils/cn';

interface PrayButtonProps {
  prayerRequestId: number;
  initialPraying: boolean;
  initialCount: number;
}

export function PrayButton({
  prayerRequestId,
  initialPraying,
  initialCount,
}: PrayButtonProps) {
  const { isPraying, prayCount, loading, toggle } = usePrayerToggle(
    prayerRequestId,
    initialPraying,
    initialCount
  );

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={isPraying ? 'Stop praying' : 'Pray for this request'}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all active:scale-95',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isPraying
          ? 'bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary'
          : 'bg-black/5 text-text-muted hover:bg-black/10 hover:text-text dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15'
      )}
    >
      <span className="text-base leading-none">&#x1F64F;</span>
      <span>{prayCount > 0 ? `${prayCount} praying` : 'Pray'}</span>
    </button>
  );
}
