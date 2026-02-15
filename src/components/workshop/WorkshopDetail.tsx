'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
  Repeat,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { RSVPButton } from '@/components/workshop/RSVPButton';
import { InviteUsersModal } from '@/components/workshop/InviteUsersModal';

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

export function WorkshopDetail({ workshop, userRsvp, isHost }: WorkshopDetailProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [rsvpd, setRsvpd] = useState(!!userRsvp);
  const [attendeeCount, setAttendeeCount] = useState(workshop.attendee_count);

  const statusConfig = STATUS_CONFIG[workshop.status] ?? STATUS_CONFIG.scheduled;
  const rruleDesc = workshop.series ? parseRruleDescription(workshop.series.rrule) : null;

  const handleRsvpChange = (isRsvpd: boolean) => {
    setRsvpd(isRsvpd);
    setAttendeeCount((prev) => (isRsvpd ? prev + 1 : Math.max(0, prev - 1)));
  };

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

          {/* Next in series */}
          {workshop.next_in_series && (
            <Link
              href={`/workshops/${workshop.next_in_series.id}`}
              className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-primary">Next Session</div>
                <div className="truncate text-sm text-text dark:text-text-dark">
                  {workshop.next_in_series.title}
                </div>
                <div className="text-xs text-text-muted dark:text-text-muted-dark">
                  {formatDate(workshop.next_in_series.scheduled_at)}
                </div>
              </div>
            </Link>
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

      {/* 5. Attendees Section */}
      <Card className="mx-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-text-muted dark:text-text-muted-dark" />
            <span className="text-sm font-medium text-text dark:text-text-dark">
              {attendeeCount} attending
            </span>
            {workshop.max_capacity != null && (
              <span className="text-xs text-text-muted dark:text-text-muted-dark">
                / {workshop.max_capacity} max
              </span>
            )}
          </div>
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
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
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

          {/* Host controls */}
          {isHost && (
            <>
              {workshop.status === 'scheduled' && (
                <Link href={`/workshops/${workshop.id}/live`}>
                  <Button variant="secondary" size="md">
                    <Radio className="h-4 w-4" />
                    Start
                  </Button>
                </Link>
              )}

              <Link href={`/workshops/${workshop.id}/edit`}>
                <Button variant="outline" size="md">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>

              {workshop.is_private && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setInviteOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Invite modal */}
      {isHost && workshop.is_private && (
        <InviteUsersModal
          workshopId={workshop.id}
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}
