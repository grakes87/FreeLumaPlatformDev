'use client';

import { cn } from '@/lib/utils/cn';
import type { NotificationFilter } from '@/hooks/useNotifications';

interface NotificationFiltersProps {
  activeFilter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
}

const FILTER_TABS: { label: string; value: NotificationFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Follows', value: 'follows' },
  { label: 'Reactions', value: 'reactions' },
  { label: 'Comments', value: 'comments' },
  { label: 'Prayer', value: 'prayer' },
];

export function NotificationFilters({ activeFilter, onFilterChange }: NotificationFiltersProps) {
  return (
    <div className="scrollbar-hide flex gap-1 overflow-x-auto px-4 py-2" style={{ scrollbarWidth: 'none' }}>
      {FILTER_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onFilterChange(tab.value)}
          className={cn(
            'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            activeFilter === tab.value
              ? 'bg-primary text-white'
              : 'bg-slate-100 text-text-muted hover:bg-slate-200 dark:bg-white/10 dark:text-text-muted-dark dark:hover:bg-white/15'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
