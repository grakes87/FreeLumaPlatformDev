'use client';

import { useState, useMemo } from 'react';
import { Sparkles, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DayCard, type DayData } from './DayCard';
import { GenerationProgressModal } from './GenerationProgressModal';

interface UnassignedTabProps {
  days: DayData[];
  month: string;
  mode: 'bible' | 'positivity';
  onRefresh: () => void;
}

export function UnassignedTab({ days, month, mode, onRefresh }: UnassignedTabProps) {
  const [genModal, setGenModal] = useState<{ open: boolean; day?: number }>({
    open: false,
  });

  // Parse month to figure out total days, then find missing dates
  const { emptyDays, missingDates } = useMemo(() => {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const totalDays = new Date(year, monthNum, 0).getDate();

    // Days already in the API response with status 'empty'
    const empty = days.filter((d) => d.status === 'empty');

    // Dates that have no record at all (not returned by API)
    const existingDates = new Set(days.map((d) => d.post_date));
    const missing: string[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      if (!existingDates.has(dateStr)) {
        missing.push(dateStr);
      }
    }

    return { emptyDays: empty, missingDates: missing };
  }, [days, month]);

  const totalUnassigned = emptyDays.length + missingDates.length;

  const handleModalClose = () => {
    setGenModal({ open: false });
    onRefresh();
  };

  if (totalUnassigned === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
        <Calendar className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium text-text dark:text-text-dark">
          All days have content generated
        </p>
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          Every day in {month} has content. Switch to the Pending tab to review completeness.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          {totalUnassigned} day{totalUnassigned !== 1 ? 's' : ''} without content
        </p>
        <Button onClick={() => setGenModal({ open: true })}>
          <Sparkles className="h-4 w-4" /> Generate Month
        </Button>
      </div>

      {/* Missing dates (no record at all) */}
      {missingDates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
            No record ({missingDates.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {missingDates.map((dateStr) => {
              const dayNum = parseInt(dateStr.split('-')[2], 10);
              const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
              return (
                <div
                  key={dateStr}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
                >
                  <span className="text-sm font-medium text-text dark:text-text-dark">
                    {label}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setGenModal({ open: true, day: dayNum })}
                  >
                    <Sparkles className="h-3 w-3" /> Generate
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Days with status 'empty' */}
      {emptyDays.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
            Empty records ({emptyDays.length})
          </p>
          {emptyDays.map((day) => (
            <DayCard key={day.id} day={day} mode={mode} />
          ))}
        </div>
      )}

      {/* Generation modal */}
      <GenerationProgressModal
        open={genModal.open}
        onClose={handleModalClose}
        month={month}
        mode={mode}
        day={genModal.day}
      />
    </div>
  );
}
