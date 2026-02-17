'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Lock,
  Users,
  Play,
  Pencil,
  Radio,
  UserPlus,
  UserCog,
  Repeat,
  ChevronRight,
  ChevronDown,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { RSVPButton } from '@/components/workshop/RSVPButton';
import { InviteUsersModal } from '@/components/workshop/InviteUsersModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';

// ---- Types ----

interface WorkshopHost {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string | null;
}

interface WorkshopCategory {
  id: number;
  name: string;
  slug: string;
}

interface WorkshopSeries {
  id: number;
  title: string;
  rrule: string | null;
}

interface NextInSeries {
  id: number;
  title: string;
  scheduled_at: string;
}

interface WorkshopAttendeePreview {
  id: number;
  user_id: number;
  user: {
    id: number;
    display_name: string;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
  };
}

export interface WorkshopData {
  id: number;
  title: string;
  description: string | null;
  status: 'scheduled' | 'starting_soon' | 'live' | 'ended' | 'cancelled';
  scheduled_at: string;
  duration_minutes: number | null;
  is_private: boolean;
  max_capacity: number | null;
  attendee_count: number;
  recording_url: string | null;
  has_recording: boolean;
  host_id: number;
  host: WorkshopHost;
  category: WorkshopCategory | null;
  series: WorkshopSeries | null;
  series_id: number | null;
  next_in_series: NextInSeries | null;
}

export interface RsvpData {
  status: string;
  is_co_host: boolean;
  can_speak: boolean;
}

export interface WorkshopDetailProps {
  workshop: WorkshopData;
  userRsvp: RsvpData | null;
  isHost: boolean;
}

// ---- Helpers ----

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: {
    label: 'Scheduled',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  starting_soon: {
    label: 'Starting Soon',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  live: {
    label: 'LIVE',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  ended: {
    label: 'Ended',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `~${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `~${h} hour${h > 1 ? 's' : ''}`;
  return `~${h}h ${m}m`;
}

function parseRruleDescription(rrule: string | null): string | null {
  if (!rrule) return null;
  // Extract basic recurrence info from rrule string
  const freqMatch = rrule.match(/FREQ=(\w+)/);
  const dayMatch = rrule.match(/BYDAY=(\w+)/);
  if (!freqMatch) return null;

  const freq = freqMatch[1].toLowerCase();
  const dayMap: Record<string, string> = {
    MO: 'Mondays',
    TU: 'Tuesdays',
    WE: 'Wednesdays',
    TH: 'Thursdays',
    FR: 'Fridays',
    SA: 'Saturdays',
    SU: 'Sundays',
  };

  const day = dayMatch ? dayMap[dayMatch[1]] : null;
  if (freq === 'weekly' && day) return `Repeats weekly on ${day}`;
  if (freq === 'weekly') return 'Repeats weekly';
  if (freq === 'daily') return 'Repeats daily';
  if (freq === 'monthly') return 'Repeats monthly';
  return `Repeats ${freq}`;
}

// ---- Component ----

interface SeriesSession {
  id: number;
  title: string;
  scheduled_at: string;
  status: string;
}

export function WorkshopDetail({ workshop, userRsvp, isHost }: WorkshopDetailProps) {
  const router = useRouter();
  const [inviteMode, setInviteMode] = useState<'invite' | 'cohost' | null>(null);
  const [rsvpd, setRsvpd] = useState(!!userRsvp);
  const [attendeeCount, setAttendeeCount] = useState(workshop.attendee_count);
  const [seriesExpanded, setSeriesExpanded] = useState(false);
  const [seriesSessions, setSeriesSessions] = useState<SeriesSession[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Cancel confirmation state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCancelChoice, setShowCancelChoice] = useState(false);
  const [showCancelSeriesConfirm, setShowCancelSeriesConfirm] = useState(false);

  const canManage = workshop.status !== 'ended' && workshop.status !== 'cancelled';

  const statusConfig = STATUS_CONFIG[workshop.status] ?? STATUS_CONFIG.scheduled;
  const rruleDesc = workshop.series ? parseRruleDescription(workshop.series.rrule) : null;

  const handleRsvpChange = (isRsvpd: boolean) => {
    setRsvpd(isRsvpd);
    setAttendeeCount((prev) => (isRsvpd ? prev + 1 : Math.max(0, prev - 1)));
  };

  const loadSeriesSessions = useCallback(async () => {
    if (seriesExpanded) {
      setSeriesExpanded(false);
      return;
    }
    if (!workshop.series_id || seriesSessions.length > 0) {
      setSeriesExpanded(true);
      return;
    }
    setSeriesLoading(true);
    try {
      const res = await fetch(`/api/workshops?series_id=${workshop.series_id}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setSeriesSessions(data.workshops ?? []);
      }
    } finally {
      setSeriesLoading(false);
      setSeriesExpanded(true);
    }
  }, [workshop.series_id, seriesSessions.length, seriesExpanded]);

  // Opens cancel flow: if series workshop, show choice; otherwise show single confirm
  const handleCancelRequest = useCallback(() => {
    if (workshop.series_id) {
      setShowCancelChoice(true);
    } else {
      setShowCancelConfirm(true);
    }
  }, [workshop.series_id]);

  // Cancel single workshop
  const handleCancelConfirm = useCallback(async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/workshops/${workshop.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setCancelling(false);
    }
  }, [workshop.id, router]);

  // Cancel all future series workshops
  const handleCancelFutureSeries = useCallback(async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/workshops/${workshop.id}?cancel_future=true`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setCancelling(false);
    }
  }, [workshop.id, router]);

  return (
    <div className="mx-auto max-w-2xl pb-32">
      {/* 1. Header Section */}
      <div className="px-4 pt-4">
        {/* Category badge */}
        {workshop.category && (
          <span className="mb-2 inline-flex rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary dark:bg-primary/20">
            {workshop.category.name}
          </span>
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold leading-tight text-text dark:text-text-dark">
          {workshop.title}
        </h1>

        {/* Status + Private indicator */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
              statusConfig.color
            )}
          >
            {workshop.status === 'live' && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            )}
            {statusConfig.label}
          </span>

          {workshop.is_private && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              <Lock className="h-3 w-3" />
              Invite only
            </span>
          )}
        </div>
      </div>

      {/* Host Management Bar */}
      {isHost && canManage && (
        <div className="mx-4 mt-3 flex items-center gap-2 overflow-x-auto">
          {workshop.status === 'scheduled' && (
            <Link href={`/workshops/${workshop.id}/live`} className="shrink-0">
              <button className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700">
                <Radio className="h-4 w-4" />
                Go Live
              </button>
            </Link>
          )}

          <Link href={`/workshops/${workshop.id}/edit`} className="shrink-0">
            <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface-hover dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-surface-hover-dark">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          </Link>

          {(workshop.status === 'scheduled' || workshop.status === 'starting_soon') && (
            <button
              onClick={handleCancelRequest}
              disabled={cancelling}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-200 bg-surface px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-surface-dark dark:text-red-400 dark:hover:bg-red-950"
            >
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Cancel
            </button>
          )}
        </div>
      )}

      {/* 2. Host Section */}
      <Card className="mx-4 mt-4">
        <div className="flex items-center gap-3">
          {workshop.host.avatar_url ? (
            <img
              src={workshop.host.avatar_url}
              alt={workshop.host.display_name}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <InitialsAvatar
              name={workshop.host.display_name}
              color={workshop.host.avatar_color}
              size={48}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-text dark:text-text-dark">
              {workshop.host.display_name}
            </div>
            <Link
              href={`/profile/${workshop.host.username}`}
              className="text-sm text-primary hover:underline"
            >
              @{workshop.host.username}
            </Link>
          </div>
          <Link
            href={`/profile/${workshop.host.username}`}
            className="text-sm font-medium text-primary"
          >
            View Profile
          </Link>
        </div>

        {/* Series info */}
        {workshop.series && (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 dark:border-border-dark">
            <Repeat className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
            <span className="text-sm text-text-muted dark:text-text-muted-dark">
              Part of{' '}
              <span className="font-medium text-text dark:text-text-dark">
                {workshop.series.title}
              </span>
            </span>
          </div>
        )}
      </Card>

      {/* 3. Schedule Section */}
      <Card className="mx-4 mt-4">
        <div className="space-y-3">
          {/* Date */}
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 shrink-0 text-text-muted dark:text-text-muted-dark" />
            <span className="text-sm text-text dark:text-text-dark">
              {formatDate(workshop.scheduled_at)}
            </span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 shrink-0 text-text-muted dark:text-text-muted-dark" />
            <span className="text-sm text-text dark:text-text-dark">
              {formatTime(workshop.scheduled_at)}
              {workshop.duration_minutes != null && (
                <span className="ml-2 text-text-muted dark:text-text-muted-dark">
                  ({formatDuration(workshop.duration_minutes)})
                </span>
              )}
            </span>
          </div>

          {/* Recurrence */}
          {rruleDesc && (
            <div className="flex items-center gap-3">
              <Repeat className="h-5 w-5 shrink-0 text-text-muted dark:text-text-muted-dark" />
              <span className="text-sm text-text-muted dark:text-text-muted-dark">
                {rruleDesc}
              </span>
            </div>
          )}

          {/* Series sessions — expandable list */}
          {workshop.series_id && (
            <div className="space-y-2">
              <button
                onClick={loadSeriesSessions}
                className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                {seriesLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : seriesExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {seriesExpanded ? 'Sessions' : 'View All Sessions'}
                {seriesSessions.length > 0 && ` (${seriesSessions.length})`}
              </button>

              {seriesExpanded && seriesSessions.length > 0 && (
                <div className="space-y-1 pl-2">
                  {seriesSessions.map((session) => {
                    const isCurrent = session.id === workshop.id;
                    const sessionStatus = STATUS_CONFIG[session.status];
                    return (
                      <Link
                        key={session.id}
                        href={`/workshops/${session.id}`}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          isCurrent
                            ? 'bg-primary/10 dark:bg-primary/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-text dark:text-text-dark">
                            {session.title}
                          </div>
                          <div className="text-xs text-text-muted dark:text-text-muted-dark">
                            {formatDate(session.scheduled_at)} &middot; {formatTime(session.scheduled_at)}
                          </div>
                        </div>
                        {sessionStatus && (
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', sessionStatus.color)}>
                            {sessionStatus.label}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="shrink-0 text-xs font-medium text-primary">Current</span>
                        )}
                      </Link>
                    );
                  })}

                  <Link
                    href={`/workshops/series/${workshop.series_id}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary hover:underline"
                  >
                    <Repeat className="h-3.5 w-3.5" />
                    View Series Overview
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 4. Description Section */}
      {workshop.description && (
        <Card className="mx-4 mt-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
            About
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text dark:text-text-dark">
            {workshop.description}
          </p>
        </Card>
      )}

      {/* 5. Invite / Co-host + Attendees Section */}
      {isHost && canManage && (
        <div className="mx-4 mt-4 flex items-center gap-2">
          <button
            onClick={() => setInviteMode('invite')}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface-hover dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-surface-hover-dark"
          >
            <UserPlus className="h-4 w-4" />
            Invite People
          </button>
          <button
            onClick={() => setInviteMode('cohost')}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface-hover dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-surface-hover-dark"
          >
            <UserCog className="h-4 w-4" />
            Add Co-host
          </button>
        </div>
      )}

      <Card className="mx-4 mt-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-text-muted dark:text-text-muted-dark" />
          <span className="text-sm font-medium text-text dark:text-text-dark">
            {attendeeCount} attending
          </span>
        </div>
      </Card>

      {/* 6. Recording Section (ended + has recording) */}
      {workshop.status === 'ended' && workshop.has_recording && (
        <Card className="mx-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-text dark:text-text-dark">
                Recording Available
              </div>
              <div className="text-xs text-text-muted dark:text-text-muted-dark">
                Watch the recorded workshop session
              </div>
            </div>
            <Link
              href="/watch"
              className="text-sm font-medium text-primary hover:underline"
            >
              Watch
            </Link>
          </div>
        </Card>
      )}

      {/* 7. Actions Section (fixed bottom on mobile) */}
      <div className="fixed inset-x-0 z-20 border-t border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {/* Live workshop: Join button takes priority */}
          {workshop.status === 'live' && (
            <Link href={`/workshops/${workshop.id}/live`} className="flex-1">
              <Button variant="primary" fullWidth size="lg">
                <Radio className="h-5 w-5" />
                Join Workshop
              </Button>
            </Link>
          )}

          {/* Scheduled: show RSVP */}
          {workshop.status !== 'live' && workshop.status !== 'ended' && workshop.status !== 'cancelled' && (
            <div className="flex-1">
              <RSVPButton
                workshopId={workshop.id}
                initialRsvp={rsvpd}
                workshopStatus={workshop.status}
                isHost={isHost}
                onRsvpChange={handleRsvpChange}
              />
            </div>
          )}

          {/* Ended: show recording button if available */}
          {workshop.status === 'ended' && workshop.has_recording && (
            <Link href="/watch" className="flex-1">
              <Button variant="primary" fullWidth>
                <Play className="h-4 w-4" />
                Watch Recording
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Invite / Co-host modal */}
      {isHost && (
        <InviteUsersModal
          workshopId={workshop.id}
          isOpen={inviteMode !== null}
          onClose={() => setInviteMode(null)}
          mode={inviteMode ?? 'invite'}
        />
      )}

      {/* Cancel single workshop confirmation */}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelConfirm}
        title="Cancel Workshop"
        message="Cancel this workshop? All RSVP'd attendees will be notified. This cannot be undone."
        confirmLabel="Cancel Workshop"
        cancelLabel="Keep It"
        danger
      />

      {/* Series cancel choice modal */}
      <Modal
        isOpen={showCancelChoice}
        onClose={() => setShowCancelChoice(false)}
        title="Cancel Workshop"
        size="sm"
      >
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          This workshop is part of a series. What would you like to cancel?
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              setShowCancelChoice(false);
              setShowCancelConfirm(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-border-dark dark:hover:bg-slate-800"
          >
            <XCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div>
              <div className="text-sm font-semibold text-text dark:text-text-dark">
                Cancel This Event Only
              </div>
              <div className="text-xs text-text-muted dark:text-text-muted-dark">
                Only this session will be cancelled
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCancelChoice(false);
              setShowCancelSeriesConfirm(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-red-200 px-4 py-3 text-left transition-colors hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            <Repeat className="h-5 w-5 shrink-0 text-red-500" />
            <div>
              <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                Cancel All Future Events
              </div>
              <div className="text-xs text-text-muted dark:text-text-muted-dark">
                All scheduled future sessions in this series will be cancelled
              </div>
            </div>
          </button>
        </div>
      </Modal>

      {/* Series cancel confirmation */}
      <ConfirmDialog
        isOpen={showCancelSeriesConfirm}
        onClose={() => setShowCancelSeriesConfirm(false)}
        onConfirm={handleCancelFutureSeries}
        title="Cancel All Future Events"
        message="This will cancel all scheduled future workshops in this series. Attendees of each event will be notified. This cannot be undone."
        confirmLabel="Cancel All Future"
        cancelLabel="Go Back"
        danger
      />
    </div>
  );
}
