'use client';

import { cn } from '@/lib/utils/cn';

export type WorkshopTab = 'upcoming' | 'past' | 'my';

export interface WorkshopCategoryItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  workshop_count: number;
}

export interface WorkshopFiltersProps {
  tab: WorkshopTab;
  onTabChange: (tab: WorkshopTab) => void;
  categoryId: number | null;
  onCategoryChange: (id: number | null) => void;
  categories: WorkshopCategoryItem[];
  categoriesLoading?: boolean;
}

const TABS: { key: WorkshopTab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'my', label: 'My Workshops' },
];

/**
 * Filter bar for workshop listing with tab row and category chips.
 */
export function WorkshopFilters({
  tab,
  onTabChange,
  categoryId,
  onCategoryChange,
  categories,
  categoriesLoading,
}: WorkshopFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Tab row */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              tab === t.key
                ? 'bg-white text-text shadow-sm dark:bg-white/10 dark:text-text-dark'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Category filter chips - horizontal scroll */}
      <div className="-mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {/* All chip */}
          <button
            onClick={() => onCategoryChange(null)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              categoryId === null
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-text-muted hover:bg-slate-200 dark:bg-white/5 dark:text-text-muted-dark dark:hover:bg-white/10'
            )}
          >
            All
          </button>

          {/* Category chips */}
          {categoriesLoading ? (
            // Skeleton chips
            <>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-slate-100 dark:bg-white/5"
                />
              ))}
            </>
          ) : (
            categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id === categoryId ? null : cat.id)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  categoryId === cat.id
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-text-muted hover:bg-slate-200 dark:bg-white/5 dark:text-text-muted-dark dark:hover:bg-white/10'
                )}
              >
                {cat.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
