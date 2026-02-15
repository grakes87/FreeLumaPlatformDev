'use client';

import Link from 'next/link';
import { CheckCircle2, Play, Users, Clock, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { WorkshopData } from '@/components/workshop/WorkshopDetail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** WorkshopData extended with actual timing fields returned by the detail API. */
interface WorkshopSummaryData extends WorkshopData {
  actual_started_at: string | null;
  actual_ended_at: string | null;
}

export interface WorkshopSummaryProps {
  workshop: WorkshopSummaryData;
  attendeeCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a duration between two ISO dates as "Xh Ym" or "Xm".
 */
function formatDuration(startIso: string, endIso: string): string {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const totalMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Post-workshop summary screen shown after a workshop transitions to "ended".
 *
 * Displays duration, attendance, recording availability, and next session link.
 */
export function WorkshopSummary({ workshop, attendeeCount }: WorkshopSummaryProps) {
  const hasDuration = workshop.actual_started_at && workshop.actual_ended_at;
  const duration = hasDuration
    ? formatDuration(workshop.actual_started_at!, workshop.actual_ended_at!)
    : null;

  const hasRecording = !!workshop.recording_url;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-8">
      {/* Summary card */}
      <Card className="w-full max-w-md text-center">
        {/* Completion icon */}
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {/* Header */}
        <h2 className="text-lg font-bold text-text dark:text-text-dark">
          Workshop Ended
        </h2>

        {/* Title */}
        <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
          {workshop.title}
        </p>

        {/* Stats row */}
        <div className="mt-6 flex items-center justify-center gap-6">
          {/* Duration */}
          {duration && (
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-lg font-bold text-text dark:text-text-dark">
                {duration}
              </span>
              <span className="text-xs text-text-muted dark:text-text-muted-dark">
                Duration
              </span>
            </div>
          )}

          {/* Attendees */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-lg font-bold text-text dark:text-text-dark">
              {attendeeCount}
            </span>
            <span className="text-xs text-text-muted dark:text-text-muted-dark">
              Attended
            </span>
          </div>
        </div>

        {/* Recording status */}
        <div className="mt-6 rounded-xl border border-border bg-slate-50 px-4 py-3 dark:border-border-dark dark:bg-slate-800">
          {hasRecording ? (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Play className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-text dark:text-text-dark">
                  Recording Available
                </p>
                <p className="text-xs text-text-muted dark:text-text-muted-dark">
                  Watch the full workshop session
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted dark:text-text-muted-dark" />
              <div className="text-left">
                <p className="text-sm font-medium text-text dark:text-text-dark">
                  Recording processing...
                </p>
                <p className="text-xs text-text-muted dark:text-text-muted-dark">
                  This may take a few minutes
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Next in series */}
        {workshop.next_in_series && (
          <Link
            href={`/workshops/${workshop.next_in_series.id}`}
            className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100 dark:border-border-dark dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-medium text-primary">Next Session</p>
              <p className="truncate text-sm text-text dark:text-text-dark">
                {workshop.next_in_series.title}
              </p>
              <p className="text-xs text-text-muted dark:text-text-muted-dark">
                {new Date(workshop.next_in_series.scheduled_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </Link>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex flex-col gap-3">
          {hasRecording && (
            <Link href="/watch">
              <Button variant="primary" fullWidth>
                <Play className="h-4 w-4" />
                View Recording
              </Button>
            </Link>
          )}

          <Link href="/workshops">
            <Button variant={hasRecording ? 'outline' : 'primary'} fullWidth>
              <ArrowLeft className="h-4 w-4" />
              Back to Workshops
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
