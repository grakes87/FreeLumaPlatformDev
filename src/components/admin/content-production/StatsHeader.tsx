'use client';

import { cn } from '@/lib/utils/cn';

export interface ContentStats {
  total_days: number;
  generated: number;
  assigned: number;
  submitted: number;
  approved: number;
  missing: number;
}

interface StatsHeaderProps {
  stats: ContentStats | null;
  loading?: boolean;
}

const STAT_CONFIG: {
  key: keyof ContentStats;
  label: string;
  color: string;
}[] = [
  { key: 'total_days', label: 'Total Days', color: 'text-text dark:text-text-dark' },
  { key: 'generated', label: 'Generated', color: 'text-blue-600 dark:text-blue-400' },
  { key: 'assigned', label: 'Assigned', color: 'text-purple-600 dark:text-purple-400' },
  { key: 'submitted', label: 'Submitted', color: 'text-amber-600 dark:text-amber-400' },
  { key: 'approved', label: 'Approved', color: 'text-green-600 dark:text-green-400' },
  { key: 'missing', label: 'Missing', color: 'text-red-600 dark:text-red-400' },
];

export function StatsHeader({ stats, loading }: StatsHeaderProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {STAT_CONFIG.map(({ key, label, color }) => (
        <div
          key={key}
          className="rounded-xl border border-border bg-surface p-3 text-center dark:border-border-dark dark:bg-surface-dark"
        >
          {loading || !stats ? (
            <div className="mx-auto h-8 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          ) : (
            <p className={cn('text-2xl font-bold', color)}>
              {stats[key]}
            </p>
          )}
          <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}
