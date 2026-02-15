'use client';

import Link from 'next/link';
import {
  Users,
  Calendar,
  Clock,
  BarChart3,
  Trophy,
  Film,
  ChevronRight,
  Repeat,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';

// ---- Types ----

interface WorkshopItem {
  id: number;
  title: string;
  scheduled_at: string;
  actual_started_at?: string | null;
  actual_ended_at?: string | null;
  attendee_count: number;
  max_capacity?: number | null;
  recording_url?: string | null;
  duration_minutes?: number | null;
  category?: { id: number; name: string } | null;
}

interface TrendPoint {
  date: string;
  title: string;
  attendees: number;
}

interface SeriesItem {
  id: number;
  title: string;
  rrule: string;
  time_of_day: string;
  timezone: string;
  duration_minutes: number | null;
  category?: { id: number; name: string } | null;
  workshops?: { id: number; title: string; scheduled_at: string; status: string }[];
}

export interface DashboardData {
  stats: {
    totalWorkshops: number;
    totalAttendees: number;
    averageDuration: number;
    averageAttendance: number;
    totalRecordings: number;
    upcomingCount: number;
  };
  upcomingWorkshops: WorkshopItem[];
  recentWorkshops: WorkshopItem[];
  attendanceTrend: TrendPoint[];
  topWorkshops: WorkshopItem[];
  series: SeriesItem[];
}

interface HostDashboardProps {
  data: DashboardData;
}

// ---- Helpers ----

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---- Stat Card ----

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card padding="md" className="flex items-center gap-3">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          color
        )}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-text dark:text-text-dark">
          {value}
        </p>
        <p className="truncate text-xs text-text-muted dark:text-text-muted-dark">
          {label}
        </p>
      </div>
    </Card>
  );
}

// ---- Main Component ----

export function HostDashboard({ data }: HostDashboardProps) {
  const { stats, upcomingWorkshops, recentWorkshops, attendanceTrend, topWorkshops, series } = data;

  const maxAttendees = Math.max(...attendanceTrend.map((p) => p.attendees), 1);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Calendar}
            label="Total Workshops"
            value={stats.totalWorkshops}
            color="bg-blue-500"
          />
          <StatCard
            icon={Users}
            label="Total Attendees"
            value={stats.totalAttendees}
            color="bg-emerald-500"
          />
          <StatCard
            icon={Clock}
            label="Avg Duration"
            value={formatDuration(stats.averageDuration)}
            color="bg-purple-500"
          />
          <StatCard
            icon={BarChart3}
            label="Avg Attendance"
            value={stats.averageAttendance}
            color="bg-amber-500"
          />
        </div>
      </section>

      {/* Attendance Trend */}
      {attendanceTrend.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
            Attendance Trend
          </h2>
          <Card padding="md">
            <div className="flex items-end gap-2" style={{ height: 160 }}>
              {attendanceTrend.map((point, i) => {
                const heightPct = Math.max((point.attendees / maxAttendees) * 100, 4);
                return (
                  <div
                    key={i}
                    className="group flex flex-1 flex-col items-center gap-1"
                  >
                    {/* Tooltip */}
                    <div className="invisible text-center text-xs text-text-muted opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 dark:text-text-muted-dark">
                      <span className="font-medium">{point.attendees}</span>
                    </div>
                    {/* Bar */}
                    <div
                      className="w-full min-w-[8px] max-w-[40px] rounded-t-md bg-primary/80 transition-all group-hover:bg-primary"
                      style={{ height: `${heightPct}%` }}
                      title={`${point.title}: ${point.attendees} attendees`}
                    />
                    {/* Date label */}
                    <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
                      {formatShortDate(point.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}

      {/* Upcoming Workshops */}
      {upcomingWorkshops.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
              Upcoming ({stats.upcomingCount})
            </h2>
            <Link
              href="/workshops?my=true"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingWorkshops.map((w) => (
              <Link key={w.id} href={`/workshops/${w.id}`}>
                <Card padding="sm" hoverable className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text dark:text-text-dark">
                      {w.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-muted dark:text-text-muted-dark">
                      <span>{formatDate(w.scheduled_at)}</span>
                      {w.category && (
                        <>
                          <span aria-hidden="true">-</span>
                          <span>{w.category.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">
                      {w.attendee_count}
                      {w.max_capacity ? `/${w.max_capacity}` : ''} RSVPs
                    </span>
                    <ChevronRight className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top Workshops */}
      {topWorkshops.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
            Top Workshops
          </h2>
          <Card padding="sm">
            <div className="divide-y divide-border dark:divide-border-dark">
              {topWorkshops.map((w, i) => (
                <Link
                  key={w.id}
                  href={`/workshops/${w.id}`}
                  className="flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      i === 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : i === 1
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          : i === 2
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-500'
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text dark:text-text-dark">
                      {w.title}
                    </p>
                    {w.category && (
                      <p className="text-xs text-text-muted dark:text-text-muted-dark">
                        {w.category.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                    <Trophy className="h-3.5 w-3.5" />
                    {w.attendee_count}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Recent Workshops */}
      {recentWorkshops.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
            Recent Workshops
          </h2>
          <div className="space-y-2">
            {recentWorkshops.map((w) => (
              <Link key={w.id} href={`/workshops/${w.id}`}>
                <Card padding="sm" hoverable className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text dark:text-text-dark">
                      {w.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-muted dark:text-text-muted-dark">
                      <span>{formatDate(w.scheduled_at)}</span>
                      <span aria-hidden="true">-</span>
                      <span>{w.attendee_count} attendees</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.recording_url && (
                      <span title="Recording available">
                        <Film className="h-4 w-4 text-emerald-500" />
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Active Series */}
      {series.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
            Active Series
          </h2>
          <div className="space-y-2">
            {series.map((s) => {
              const nextInstance = s.workshops?.[0];
              return (
                <Card key={s.id} padding="sm" className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <Repeat className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text dark:text-text-dark">
                      {s.title}
                    </p>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark">
                      {nextInstance
                        ? `Next: ${formatDate(nextInstance.scheduled_at)}`
                        : 'No upcoming instances'}
                    </p>
                  </div>
                  {s.category && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {s.category.name}
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
