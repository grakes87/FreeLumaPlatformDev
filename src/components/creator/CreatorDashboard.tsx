'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Clock, ThumbsUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { MonthSelector } from '@/components/admin/content-production/MonthSelector';
import { AssignmentList } from './AssignmentList';

interface CreatorStats {
  total: {
    assigned: number;
    completed: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  current_month: {
    assigned: number;
    completed: number;
    pending: number;
  };
}

export interface Assignment {
  id: number;
  post_date: string;
  mode: 'bible' | 'positivity';
  status: 'empty' | 'generated' | 'assigned' | 'submitted' | 'rejected' | 'approved';
  title: string;
  verse_reference: string | null;
  has_camera_script: boolean;
  has_creator_video: boolean;
  has_audio: boolean;
  has_srt: boolean;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const STAT_CARDS = [
  { key: 'completed' as const, label: 'Completed', icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
  { key: 'pending' as const, label: 'Pending', icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
  { key: 'approved' as const, label: 'Approved', icon: ThumbsUp, color: 'text-blue-600 dark:text-blue-400' },
];

export default function CreatorDashboard() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  // Fetch stats on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setLoadingStats(true);
      try {
        const res = await fetch('/api/creator/stats');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // silently fail -- layout already verified access
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  // Fetch assignments when month changes
  const fetchAssignments = useCallback(async (m: string) => {
    setLoadingAssignments(true);
    try {
      const res = await fetch(`/api/creator/assignments?month=${m}`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments(month);
  }, [month, fetchAssignments]);

  // Determine if deadline notice should show
  const now = new Date();
  const isCurrentMonth = month === getCurrentMonth();
  const dayOfMonth = now.getDate();
  const hasPending = assignments.some(
    (a) => a.status === 'assigned' || a.status === 'rejected'
  );
  const showDeadlineNotice = isCurrentMonth && dayOfMonth < 15 && hasPending;

  return (
    <div className="space-y-6">
      {/* Stats section */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-text-muted dark:text-text-muted-dark">
          This Month
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
            <div
              key={key}
              className="rounded-xl border border-border bg-surface p-3 text-center dark:border-border-dark dark:bg-surface-dark"
            >
              {loadingStats || !stats ? (
                <div className="mx-auto h-8 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              ) : (
                <div className="flex items-center justify-center gap-1.5">
                  <Icon className={cn('h-4 w-4', color)} />
                  <p className={cn('text-2xl font-bold', color)}>
                    {key === 'approved' ? stats.total.approved : stats.current_month[key]}
                  </p>
                </div>
              )}
              <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Deadline notice */}
      {showDeadlineNotice && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            You have pending assignments due before the 15th. Please record and submit your videos soon.
          </p>
        </div>
      )}

      {/* Month selector + assignments */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-muted dark:text-text-muted-dark">
            Assignments
          </h2>
          <MonthSelector month={month} onChange={setMonth} />
        </div>

        <AssignmentList
          assignments={assignments}
          loading={loadingAssignments}
        />
      </section>
    </div>
  );
}
