'use client';

import { cn } from '@/lib/utils/cn';
import type { PrayerStatusFilter } from '@/hooks/usePrayerWall';

interface PrayerFiltersProps {
  statusFilter: PrayerStatusFilter;
  onFilterChange: (filter: PrayerStatusFilter) => void;
}

const FILTERS: { value: PrayerStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'answered', label: 'Answered' },
];

export function PrayerFilters({ statusFilter, onFilterChange }: PrayerFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => onFilterChange(f.value)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-all',
            statusFilter === f.value
              ? 'bg-white/20 text-white shadow-sm'
              : 'text-white/50 hover:text-white/70 hover:bg-white/10'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
