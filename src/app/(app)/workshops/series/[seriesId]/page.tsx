'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Repeat,
  Users,
  ChevronDown,
  ChevronUp,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { WorkshopCard } from '@/components/workshop/WorkshopCard';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { Skeleton, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';
import type { Workshop } from '@/hooks/useWorkshops';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SeriesData {
  id: number;
  host_id: number;
  title: string;
  description: string | null;
  rrule: string | null;
  time_of_day: string;
  timezone: string;
  duration_minutes: number | null;
  category_id: number | null;
  is_active: boolean;
  created_at: string;
  host: {
    id: number;
    display_name: string;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
  };
  category: {
    id: number;
    name: string;
    slug: string;
  } | null;
  workshop_count: number;
  next_scheduled_at: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRruleDescription(rrule: string | null): string | null {
  if (!rrule) return null;

  const freqMatch = rrule.match(/FREQ=(\w+)/);
  const dayMatch = rrule.match(/BYDAY=(\w+)/);
  const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
  if (!freqMatch) return null;

  const freq = freqMatch[1].toLowerCase();
  const interval = intervalMatch ? parseInt(intervalMatch[1], 10) : 1;
  const dayMap: Record<string, string> = {
    MO: 'Monday',
    TU: 'Tuesday',
    WE: 'Wednesday',
    TH: 'Thursday',
    FR: 'Friday',
    SA: 'Saturday',
    SU: 'Sunday',
  };
  const day = dayMatch ? dayMap[dayMatch[1]] : null;

  if (freq === 'weekly' && interval === 2 && day) return `Every other ${day}`;
  if (freq === 'weekly' && day) return `Every week on ${day}`;
  if (freq === 'weekly') return 'Every week';
  if (freq === 'daily') return 'Every day';
  if (freq === 'monthly') return 'Every month';
  return `Repeats ${freq}`;
}

function formatTimeOfDay(time: string, timezone: string): string {
  // time is "HH:MM" format
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  const displayMin = String(minutes).padStart(2, '0');

  // Abbreviate timezone for display
  const tzAbbrev = timezone
    .replace('America/', '')
    .replace('Europe/', '')
    .replace('_', ' ');

  return `${displayHour}:${displayMin} ${period} ${tzAbbrev}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hour${h > 1 ? 's' : ''}`;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SeriesOverviewPage({
  params: paramsPromise,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [series, setSeries] = useState<SeriesData | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ---- Fetch data ----

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch series info and workshops in parallel
      const [seriesRes, workshopsRes] = await Promise.all([
        fetch(`/api/workshops/series?host=`, { credentials: 'include' }),
        fetch(`/api/workshops?series_id=${params.seriesId}&limit=50`, {
          credentials: 'include',
        }),
      ]);

      if (!seriesRes.ok || !workshopsRes.ok) {
        setNotFound(true);
        return;
      }

      const seriesJson = await seriesRes.json();
      const workshopsJson = await workshopsRes.json();

      const seriesData = seriesJson.data ?? seriesJson;
      const workshopsData = workshopsJson.data ?? workshopsJson;

      // Find the specific series by ID
      const allSeries: SeriesData[] = seriesData.series ?? [];
      const targetSeries = allSeries.find(
        (s) => s.id === parseInt(params.seriesId, 10)
      );

      if (!targetSeries) {
        setNotFound(true);
        return;
      }

      setSeries(targetSeries);
      setWorkshops(workshopsData.workshops ?? []);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [params.seriesId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Split upcoming / past ----

  const { upcoming, past } = useMemo(() => {
    const upcomingList: Workshop[] = [];
    const pastList: Workshop[] = [];

    for (const w of workshops) {
      if (w.status === 'ended') {
        pastList.push(w);
      } else if ((w.status as string) === 'cancelled') {
        // Skip cancelled workshops
      } else {
        upcomingList.push(w);
      }
    }

    // Sort upcoming by scheduled_at ASC
    upcomingList.sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );

    // Sort past by scheduled_at DESC
    pastList.sort(
      (a, b) =>
        new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
    );

    return { upcoming: upcomingList, past: pastList };
  }, [workshops]);

  // ---- Cancel series handler ----

  const isHost = user?.id === series?.host_id;

  const handleCancelSeries = async () => {
    if (!series || !isHost) return;
    if (!window.confirm('Cancel this series? All future scheduled sessions will be cancelled.')) return;

    try {
      setCancelling(true);

      // Cancel all future scheduled workshops
      const cancelPromises = upcoming
        .filter((w) => w.status === 'scheduled')
        .map((w) =>
          fetch(`/api/workshops/${w.id}`, {
            method: 'DELETE',
            credentials: 'include',
          })
        );

      await Promise.all(cancelPromises);

      toast.success('Series cancelled successfully');
      router.push('/workshops');
    } catch {
      toast.error('Failed to cancel series');
    } finally {
      setCancelling(false);
    }
  };

  // ---- Loading ----

  if (loading) {
    return <SeriesOverviewSkeleton />;
  }

  // ---- Not found ----

  if (notFound || !series) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-white/10">
          <Repeat className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-text dark:text-text-dark">
          Series Not Found
        </h2>
        <p className="mt-1.5 text-sm text-text-muted dark:text-text-muted-dark">
          This workshop series may have been removed.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-white"
        >
          Go Back
        </button>
      </div>
    );
  }

  const rruleDesc = parseRruleDescription(series.rrule);

  return (
    <div className="min-h-[calc(100vh-7.5rem)]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg p-1 text-text-muted transition-colors hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-lg font-semibold text-text dark:text-text-dark">
          {series.title}
        </h1>
      </div>

      <div className="mx-auto max-w-2xl pb-32">
        {/* Series header */}
        <div className="px-4 pt-4">
          {/* Category badge */}
          {series.category && (
            <span className="mb-2 inline-flex rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary dark:bg-primary/20">
              {series.category.name}
            </span>
          )}

          {/* Title */}
          <h2 className="text-2xl font-bold leading-tight text-text dark:text-text-dark">
            {series.title}
          </h2>

          {/* Series badge */}
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              <Repeat className="h-3 w-3" />
              Recurring Series
            </span>
          </div>
        </div>

        {/* Host info */}
        <Card className="mx-4 mt-4">
          <div className="flex items-center gap-3">
            {series.host.avatar_url ? (
              <img
                src={series.host.avatar_url}
                alt={series.host.display_name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <InitialsAvatar
                name={series.host.display_name}
                color={series.host.avatar_color}
                size={48}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-text dark:text-text-dark">
                {series.host.display_name}
              </div>
              <Link
                href={`/profile/${series.host.username}`}
                className="text-sm text-primary hover:underline"
              >
                @{series.host.username}
              </Link>
            </div>
          </div>
        </Card>

        {/* Schedule info */}
        <Card className="mx-4 mt-4">
          <div className="space-y-3">
            {/* Recurrence */}
            {rruleDesc && (
              <div className="flex items-center gap-3">
                <Repeat className="h-5 w-5 shrink-0 text-text-muted dark:text-text-muted-dark" />
                <span className="text-sm font-medium text-text dark:text-text-dark">
                  {rruleDesc}
                </span>
              </div>
            )}

            {/* Time */}
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 shrink-0 text-text-muted dark:text-text-muted-dark" />
              <span className="text-sm text-text dark:text-text-dark">
                {formatTimeOfDay(series.time_of_day, series.timezone)}
              </span>
            </div>

            {/* Duration estimate */}
            {series.duration_minutes && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 shrink-0 text-text-muted dark:text-text-muted-dark" />
                <span className="text-sm text-text-muted dark:text-text-muted-dark">
                  ~{formatDuration(series.duration_minutes)}
                </span>
              </div>
            )}

            {/* Workshop count */}
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 shrink-0 text-text-muted dark:text-text-muted-dark" />
              <span className="text-sm text-text-muted dark:text-text-muted-dark">
                {series.workshop_count} session{series.workshop_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </Card>

        {/* Description */}
        {series.description && (
          <Card className="mx-4 mt-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
              About
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text dark:text-text-dark">
              {series.description}
            </p>
          </Card>
        )}

        {/* Host actions */}
        {isHost && (
          <div className="mx-4 mt-4 flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelSeries}
              loading={cancelling}
            >
              <XCircle className="h-4 w-4" />
              Cancel Series
            </Button>
          </div>
        )}

        {/* Upcoming Sessions */}
        <div className="mx-4 mt-6">
          <h3 className="mb-3 text-base font-bold text-text dark:text-text-dark">
            Upcoming Sessions
            <span className="ml-2 text-sm font-normal text-text-muted dark:text-text-muted-dark">
              ({upcoming.length})
            </span>
          </h3>

          {upcoming.length === 0 ? (
            <Card>
              <p className="py-4 text-center text-sm text-text-muted dark:text-text-muted-dark">
                No upcoming sessions scheduled.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcoming.map((workshop) => (
                <WorkshopCard key={workshop.id} workshop={workshop} />
              ))}
            </div>
          )}
        </div>

        {/* Past Sessions */}
        {past.length > 0 && (
          <div className="mx-4 mt-6">
            <button
              type="button"
              onClick={() => setShowPast((prev) => !prev)}
              className="mb-3 flex w-full items-center justify-between text-left"
            >
              <h3 className="text-base font-bold text-text dark:text-text-dark">
                Past Sessions
                <span className="ml-2 text-sm font-normal text-text-muted dark:text-text-muted-dark">
                  ({past.length})
                </span>
              </h3>
              {showPast ? (
                <ChevronUp className="h-5 w-5 text-text-muted dark:text-text-muted-dark" />
              ) : (
                <ChevronDown className="h-5 w-5 text-text-muted dark:text-text-muted-dark" />
              )}
            </button>

            {showPast && (
              <div className="space-y-3">
                {past.map((workshop) => (
                  <WorkshopCard key={workshop.id} workshop={workshop} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SeriesOverviewSkeleton() {
  return (
    <div className="min-h-[calc(100vh-7.5rem)]">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90">
        <Skeleton width={24} height={24} className="rounded" />
        <Skeleton width={180} height={22} />
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4">
        <Skeleton width={80} height={22} className="mb-2 rounded-full" />
        <Skeleton width="80%" height={28} className="mb-2" />
        <Skeleton width={120} height={22} className="rounded-full" />

        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-3">
            <SkeletonCircle size={48} />
            <div className="flex-1 space-y-2">
              <Skeleton width={120} height={16} />
              <Skeleton width={90} height={14} />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton width={20} height={20} className="rounded" />
              <Skeleton width={200} height={14} />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton width={20} height={20} className="rounded" />
              <Skeleton width={150} height={14} />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Skeleton width={180} height={20} className="mb-3" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
              >
                <SkeletonText lines={2} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
