'use client';

import { useState } from 'react';
import { Calendar, BookOpen, Sparkles, Video, FileText, Music, Subtitles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Assignment } from './CreatorDashboard';
import { AssignmentDetail } from './AssignmentDetail';

interface AssignmentListProps {
  assignments: Assignment[];
  loading?: boolean;
}

const STATUS_CONFIG: Record<
  Assignment['status'],
  { label: string; bg: string; text: string }
> = {
  rejected: { label: 'Rejected', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  assigned: { label: 'Assigned', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  submitted: { label: 'Submitted', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  approved: { label: 'Approved', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  generated: { label: 'Generated', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  empty: { label: 'Empty', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
};

const STATUS_ORDER: Assignment['status'][] = ['rejected', 'assigned', 'submitted', 'approved', 'generated', 'empty'];

function sortByStatus(a: Assignment, b: Assignment): number {
  const ai = STATUS_ORDER.indexOf(a.status);
  const bi = STATUS_ORDER.indexOf(b.status);
  if (ai !== bi) return ai - bi;
  // Within same status, sort by date ascending
  return a.post_date.localeCompare(b.post_date);
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="mt-2 h-4 w-48 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-2 flex gap-2">
        <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export function AssignmentList({ assignments, loading }: AssignmentListProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 dark:border-border-dark">
        <Calendar className="h-10 w-10 text-text-muted dark:text-text-muted-dark" />
        <p className="mt-3 text-sm text-text-muted dark:text-text-muted-dark">
          No assignments for this month
        </p>
      </div>
    );
  }

  const sorted = [...assignments].sort(sortByStatus);

  return (
    <>
      <div className="space-y-3">
        {sorted.map((assignment) => {
          const statusCfg = STATUS_CONFIG[assignment.status];

          return (
            <button
              key={assignment.id}
              type="button"
              onClick={() => setSelectedId(assignment.id)}
              className="w-full rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-hover dark:border-border-dark dark:bg-surface-dark dark:hover:bg-surface-hover-dark"
            >
              {/* Top row: date + status badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text dark:text-text-dark">
                  {formatDate(assignment.post_date)}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                    statusCfg.bg,
                    statusCfg.text
                  )}
                >
                  {assignment.status === 'rejected' && (
                    <AlertCircle className="mr-1 h-3 w-3" />
                  )}
                  {statusCfg.label}
                </span>
              </div>

              {/* Title / verse */}
              <p className="mt-1.5 text-sm text-text-muted line-clamp-1 dark:text-text-muted-dark">
                {assignment.title}
                {assignment.verse_reference && (
                  <span className="ml-1 text-xs opacity-70">
                    ({assignment.verse_reference})
                  </span>
                )}
              </p>

              {/* Mode badge + asset indicators */}
              <div className="mt-2 flex items-center gap-2">
                {/* Mode badge */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    assignment.mode === 'bible'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                      : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                  )}
                >
                  {assignment.mode === 'bible' ? (
                    <BookOpen className="h-3 w-3" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {assignment.mode === 'bible' ? 'Bible' : 'Positivity'}
                </span>

                {/* Asset indicators */}
                {assignment.has_camera_script && (
                  <span title="Camera script">
                    <FileText className="h-3.5 w-3.5 text-text-muted dark:text-text-muted-dark" />
                  </span>
                )}
                {assignment.has_creator_video && (
                  <span title="Video recorded">
                    <Video className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  </span>
                )}
                {assignment.has_audio && (
                  <span title="Audio available">
                    <Music className="h-3.5 w-3.5 text-text-muted dark:text-text-muted-dark" />
                  </span>
                )}
                {assignment.has_srt && (
                  <span title="Subtitles available">
                    <Subtitles className="h-3.5 w-3.5 text-text-muted dark:text-text-muted-dark" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail overlay */}
      {selectedId !== null && (
        <AssignmentDetail
          assignmentId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
