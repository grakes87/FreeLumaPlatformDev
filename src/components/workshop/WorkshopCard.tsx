'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, isPast } from 'date-fns';
import { Users, Lock, Repeat, Clock, Pencil, Radio } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import type { Workshop } from '@/hooks/useWorkshops';

export interface WorkshopCardProps {
  workshop: Workshop;
}

function StatusBadge({ status }: { status: Workshop['status'] }) {
  switch (status) {
    case 'live':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-500/20 dark:text-red-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600 dark:bg-red-400" />
          </span>
          LIVE
        </span>
      );
    case 'lobby':
      return (
        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          Starting soon
        </span>
      );
    case 'ended':
      return (
        <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-500/20 dark:text-slate-400">
          Ended
        </span>
      );
    case 'scheduled':
    default:
      return null;
  }
}

function CategoryBadge({ category }: { category: Workshop['category'] }) {
  if (!category) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary dark:bg-primary/20">
      {category.name}
    </span>
  );
}

/**
 * Workshop card for the browse/schedule listing.
 * Shows title, host, date, category, attendee count, and status indicators.
 */
export function WorkshopCard({ workshop }: WorkshopCardProps) {
  const router = useRouter();
  const scheduledDate = new Date(workshop.scheduled_at);
  const formattedDate = format(scheduledDate, "EEE, MMM d 'at' h:mm a");
  const isEnded = workshop.status === 'ended';

  return (
    <Link href={`/workshops/${workshop.id}`} className="block">
      <Card
        hoverable
        padding="md"
        className={cn(
          'transition-all',
          isEnded && 'opacity-75'
        )}
      >
        {/* Top row: Status + indicators */}
        <div className="mb-2 flex items-center gap-2">
          <StatusBadge status={workshop.status} />
          <CategoryBadge category={workshop.category} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Private indicator */}
          {workshop.is_private && (
            <span className="text-text-muted dark:text-text-muted-dark" title="Private workshop">
              <Lock className="h-3.5 w-3.5" />
            </span>
          )}

          {/* Recurring indicator — links to series page */}
          {workshop.series_id && (
            <button
              className="text-text-muted hover:text-primary dark:text-text-muted-dark dark:hover:text-primary"
              title="View series"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/workshops/series/${workshop.series_id}`);
              }}
            >
              <Repeat className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-text dark:text-text-dark">
          {workshop.title}
        </h3>

        {/* Host info */}
        <div className="mt-2 flex items-center gap-2">
          {workshop.host.avatar_url ? (
            <img
              src={workshop.host.avatar_url}
              alt={workshop.host.display_name}
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <InitialsAvatar
              name={workshop.host.display_name}
              color={workshop.host.avatar_color}
              size={24}
              className="text-[10px]"
            />
          )}
          <span className="text-sm text-text-muted dark:text-text-muted-dark">
            {workshop.host.display_name}
          </span>
        </div>

        {/* Date/time + duration + attendees row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted dark:text-text-muted-dark">
          {/* Date */}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formattedDate}
          </span>

          {/* Duration */}
          {workshop.duration_minutes && (
            <span>~{workshop.duration_minutes} min</span>
          )}

          {/* Attendee count */}
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {workshop.attendee_count} attending
          </span>
        </div>

        {/* RSVP / Hosting badge + host quick actions */}
        {(workshop.is_host || workshop.user_rsvp) && (
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:bg-green-500/20 dark:text-green-400">
              {workshop.is_host ? 'Hosting' : workshop.user_rsvp?.is_co_host ? 'Co-host' : 'RSVP\'d'}
            </span>

            {/* Host quick actions */}
            {workshop.is_host && workshop.status !== 'ended' && (
              <>
                <div className="flex-1" />
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:border-border-dark dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                  title="Edit workshop"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/workshops/${workshop.id}/edit`);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                {workshop.status === 'scheduled' && (
                  <button
                    className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                    title="Start workshop"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/workshops/${workshop.id}/live`);
                    }}
                  >
                    <Radio className="h-3 w-3" />
                    Start
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </Link>
  );
}
