'use client';

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DayCard, type DayData } from './DayCard';

interface PendingTabProps {
  days: DayData[];
  mode: 'bible' | 'positivity';
  onRegenerate: (dayId: number, field: string) => void;
}

/** Count how many required fields are missing on a day */
function countMissing(day: DayData, mode: 'bible' | 'positivity'): number {
  let missing = 0;
  if (!day.has_camera_script) missing++;
  if (mode === 'bible' && !day.has_devotional) missing++;
  if (!day.has_meditation) missing++;
  if (!day.has_background_prompt) missing++;
  return missing;
}

/** Check if a day has any missing required fields */
function hasMissingFields(day: DayData, mode: 'bible' | 'positivity'): boolean {
  return countMissing(day, mode) > 0;
}

export function PendingTab({ days, mode, onRegenerate }: PendingTabProps) {
  // Filter to generated days with at least one missing field, sorted by most incomplete first
  const pendingDays = useMemo(() => {
    return days
      .filter((d) => d.status !== 'empty' && hasMissingFields(d, mode))
      .sort((a, b) => countMissing(b, mode) - countMissing(a, mode));
  }, [days, mode]);

  if (pendingDays.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
        <AlertTriangle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium text-text dark:text-text-dark">
          No pending content
        </p>
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          All generated content has complete fields. Nice work!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          {pendingDays.length} day{pendingDays.length !== 1 ? 's' : ''} with missing fields
        </p>
      </div>

      <div className="space-y-2">
        {pendingDays.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            mode={mode}
            onRegenerate={onRegenerate}
          />
        ))}
      </div>
    </div>
  );
}
