'use client';

import { useState, useEffect } from 'react';
import { FileWarning, Ban, Shield, AlertTriangle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/ui/Skeleton';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface ActionBreakdown {
  action: string;
  count: number;
}

interface RepeatOffender {
  user_id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  report_count: number;
}

interface ActivityDay {
  date: string;
  count: number;
}

interface ModerationStatsData {
  total_reports: number;
  pending_reports: number;
  reports_today: number;
  active_bans: number;
  action_breakdown: ActionBreakdown[];
  repeat_offenders: RepeatOffender[];
  moderation_activity_7d: ActivityDay[];
}

const ACTION_COLORS: Record<string, { bg: string; bar: string }> = {
  remove_content: { bg: 'bg-red-500', bar: 'bg-red-500' },
  warn_user: { bg: 'bg-amber-500', bar: 'bg-amber-500' },
  ban_user: { bg: 'bg-purple-500', bar: 'bg-purple-500' },
  unban_user: { bg: 'bg-green-500', bar: 'bg-green-500' },
  dismiss_report: { bg: 'bg-gray-400', bar: 'bg-gray-400' },
  edit_user: { bg: 'bg-blue-500', bar: 'bg-blue-500' },
};

const ACTION_LABELS: Record<string, string> = {
  remove_content: 'Remove',
  warn_user: 'Warn',
  ban_user: 'Ban',
  unban_user: 'Unban',
  dismiss_report: 'Dismiss',
  edit_user: 'Edit',
};

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
          >
            <Skeleton height={12} className="mb-2 w-20" />
            <Skeleton height={32} className="w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Skeleton height={14} className="mb-4 w-32" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={24} className="w-full" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Skeleton height={14} className="mb-4 w-32" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton height={28} width={28} rounded />
                <Skeleton height={12} className="flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModerationStats() {
  const toast = useToast();
  const [stats, setStats] = useState<ModerationStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/moderation-stats', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data.data || data);
        }
      } catch {
        toast.error('Failed to load moderation stats');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  if (loading || !stats) {
    return <StatsSkeleton />;
  }

  const maxActionCount = Math.max(...stats.action_breakdown.map((a) => a.count), 1);
  const maxActivityCount = Math.max(...stats.moderation_activity_7d.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={FileWarning}
          label="Total Reports"
          value={stats.total_reports}
          iconColor="text-red-500"
        />
        <StatCard
          icon={AlertTriangle}
          label="Pending"
          value={stats.pending_reports}
          iconColor="text-amber-500"
          highlight={stats.pending_reports > 0}
        />
        <StatCard
          icon={Shield}
          label="Today"
          value={stats.reports_today}
          iconColor="text-blue-500"
        />
        <StatCard
          icon={Ban}
          label="Active Bans"
          value={stats.active_bans}
          iconColor="text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Action Breakdown */}
        <div className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <h3 className="mb-4 text-sm font-semibold text-text dark:text-text-dark">
            Action Breakdown
          </h3>
          {stats.action_breakdown.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted dark:text-text-muted-dark">
              No actions taken yet
            </p>
          ) : (
            <div className="space-y-3">
              {stats.action_breakdown.map((item) => {
                const colors = ACTION_COLORS[item.action] || ACTION_COLORS.edit_user;
                const width = (item.count / maxActionCount) * 100;
                return (
                  <div key={item.action}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-text dark:text-text-dark">
                        {ACTION_LABELS[item.action] || item.action}
                      </span>
                      <span className="text-text-muted dark:text-text-muted-dark">
                        {item.count}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface-hover dark:bg-surface-hover-dark">
                      <div
                        className={cn('h-full rounded-full transition-all', colors.bar)}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Repeat Offenders */}
        <div className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <h3 className="mb-4 text-sm font-semibold text-text dark:text-text-dark">
            Repeat Offenders
          </h3>
          {stats.repeat_offenders.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted dark:text-text-muted-dark">
              No repeat offenders
            </p>
          ) : (
            <div className="space-y-2.5">
              {stats.repeat_offenders.map((offender, idx) => (
                <div key={offender.user_id} className="flex items-center gap-2.5">
                  <span className="w-4 text-right text-[10px] font-bold text-text-muted dark:text-text-muted-dark">
                    {idx + 1}
                  </span>
                  {offender.avatar_url ? (
                    <img
                      src={offender.avatar_url}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar
                      name={offender.display_name}
                      color={offender.avatar_color}
                      size={28}
                      className="shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text dark:text-text-dark">
                      {offender.display_name}
                    </p>
                    <p className="text-[10px] text-text-muted dark:text-text-muted-dark">
                      @{offender.username}
                    </p>
                  </div>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    {offender.report_count} reports
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <h3 className="mb-4 text-sm font-semibold text-text dark:text-text-dark">
          Moderation Activity (Last 7 Days)
        </h3>
        <div className="flex h-32 items-end gap-2">
          {stats.moderation_activity_7d.map((day) => {
            const height = maxActivityCount > 0 ? (day.count / maxActivityCount) * 100 : 0;
            const date = new Date(day.date + 'T00:00:00');
            const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dateLabel = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });

            return (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-text-muted dark:text-text-muted-dark">
                  {day.count}
                </span>
                <div className="flex w-full justify-center">
                  <div
                    className={cn(
                      'w-full max-w-10 rounded-t-md transition-all',
                      day.count > 0
                        ? 'bg-primary/80'
                        : 'bg-surface-hover dark:bg-surface-hover-dark'
                    )}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-medium text-text dark:text-text-dark">
                    {dayLabel}
                  </p>
                  <p className="text-[8px] text-text-muted dark:text-text-muted-dark">
                    {dateLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: typeof Shield;
  label: string;
  value: number;
  iconColor: string;
  highlight?: boolean;
}

function StatCard({ icon: Icon, label, value, iconColor, highlight }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-surface p-4 dark:bg-surface-dark',
        highlight
          ? 'border-amber-300 dark:border-amber-700'
          : 'border-border dark:border-border-dark'
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span className="text-xs text-text-muted dark:text-text-muted-dark">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-text dark:text-text-dark">{value}</p>
    </div>
  );
}
