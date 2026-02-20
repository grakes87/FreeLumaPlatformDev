'use client';

import { useState, useMemo } from 'react';
import {
  Sparkles,
  Calendar,
  Shuffle,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { DayData } from './DayCard';
import { GenerationProgressModal } from './GenerationProgressModal';

interface Creator {
  id: number;
  name: string;
  active: boolean;
  can_bible: boolean;
  can_positivity: boolean;
  languages: string[] | string;
}

interface UnassignedTabProps {
  days: DayData[];
  month: string;
  mode: 'bible' | 'positivity';
  language: string;
  creators: Creator[];
  onRefresh: () => void;
}

export function UnassignedTab({ days, month, mode, language, creators, onRefresh }: UnassignedTabProps) {
  const toast = useToast();
  const [genModal, setGenModal] = useState<{ open: boolean; day?: number }>({
    open: false,
  });
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);

  // Eligible creators for this mode and language
  const eligibleCreators = useMemo(
    () => creators.filter((c) => {
      if (!c.active) return false;
      if (mode === 'bible' ? !c.can_bible : !c.can_positivity) return false;
      const langs = Array.isArray(c.languages) ? c.languages : JSON.parse(c.languages as string || '[]');
      return langs.includes(language);
    }),
    [creators, mode, language]
  );

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    try {
      const res = await fetch('/api/admin/content-production/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'auto_assign', month, mode, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auto-assign failed');
      toast.success(`Assigned ${data.assigned} days (${data.skipped} skipped)`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auto-assign failed');
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleAssign = async (dailyContentId: number, creatorId: number) => {
    setAssigningId(dailyContentId);
    try {
      const res = await fetch('/api/admin/content-production/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reassign',
          daily_content_id: dailyContentId,
          creator_id: creatorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assignment failed');
      toast.success('Creator assigned');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssigningId(null);
    }
  };

  // Split days: unassigned records (no creator) vs missing dates (no record at all)
  const { unassignedDays, missingDates } = useMemo(() => {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const totalDays = new Date(year, monthNum, 0).getDate();

    // Days with a record but no creator assigned
    const noCreator = days.filter((d) => d.creator === null);

    // Dates that have no record at all
    const existingDates = new Set(days.map((d) => d.post_date));
    const missing: string[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      if (!existingDates.has(dateStr)) {
        missing.push(dateStr);
      }
    }

    return { unassignedDays: noCreator, missingDates: missing };
  }, [days, month]);

  const totalUnassigned = unassignedDays.length + missingDates.length;

  const handleModalClose = () => {
    setGenModal({ open: false });
    onRefresh();
  };

  const formatDate = (postDate: string) =>
    new Date(postDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const STATUS_COLORS: Record<string, string> = {
    empty: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    generated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    assigned: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  };

  if (totalUnassigned === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
        <Calendar className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium text-text dark:text-text-dark">
          All days assigned
        </p>
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          Every day in {month} has a creator assigned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          {totalUnassigned} day{totalUnassigned !== 1 ? 's' : ''} unassigned
        </p>
        <div className="flex items-center gap-2">
          {eligibleCreators.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleAutoAssign} loading={autoAssigning}>
              <Shuffle className="h-4 w-4" /> Auto-Assign All
            </Button>
          )}
          <Button onClick={() => setGenModal({ open: true })}>
            <Sparkles className="h-4 w-4" /> Generate Month
          </Button>
        </div>
      </div>

      {/* Unassigned records (have a DB row but no creator) */}
      {unassignedDays.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
            No creator assigned ({unassignedDays.length})
          </p>
          <div className="space-y-2">
            {unassignedDays.map((day) => (
              <div
                key={day.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
              >
                <Calendar className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
                <span className="min-w-[7rem] text-sm font-medium text-text dark:text-text-dark">
                  {formatDate(day.post_date)}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    STATUS_COLORS[day.status] || STATUS_COLORS.empty
                  )}
                >
                  {day.status}
                </span>
                {day.title && (
                  <span className="hidden truncate text-sm text-text-muted sm:block dark:text-text-muted-dark">
                    {day.title}
                  </span>
                )}

                {/* Creator assignment dropdown */}
                <div className="ml-auto flex items-center gap-2">
                  {assigningId === day.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : eligibleCreators.length > 0 ? (
                    <div className="relative">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const cid = parseInt(e.target.value, 10);
                          if (cid) handleAssign(day.id, cid);
                        }}
                        className={cn(
                          'appearance-none rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs text-text',
                          'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50',
                          'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                        )}
                      >
                        <option value="" disabled>
                          Assign creator...
                        </option>
                        {eligibleCreators.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing dates (no record at all) */}
      {missingDates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
            No record ({missingDates.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {missingDates.map((dateStr) => {
              const dayNum = parseInt(dateStr.split('-')[2], 10);
              return (
                <div
                  key={dateStr}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
                >
                  <span className="text-sm font-medium text-text dark:text-text-dark">
                    {formatDate(dateStr)}
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
