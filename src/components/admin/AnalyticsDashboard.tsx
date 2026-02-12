'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

interface ChartDataPoint {
  date: string;
  count: number;
}

interface TopContentItem {
  id: number;
  body: string;
  post_type: string;
  created_at: string;
  author_name: string;
  author_username: string;
  author_avatar_url: string | null;
  author_avatar_color: string;
  reaction_count: number;
  comment_count: number;
  total_engagement: number;
}

interface AnalyticsData {
  user_growth: ChartDataPoint[];
  post_volume: ChartDataPoint[];
  prayer_volume: ChartDataPoint[];
  engagement: ChartDataPoint[];
  active_users: ChartDataPoint[];
  top_content: TopContentItem[];
  totals: {
    users: number;
    posts: number;
    prayers: number;
    reactions: number;
  };
}

type Period = '7d' | '30d' | '90d';

function BarChart({
  data,
  color = 'bg-primary',
  label,
}: {
  data: ChartDataPoint[];
  color?: string;
  label: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-muted dark:text-text-muted-dark">
        No data for this period
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => Number(d.count)), 1);
  const total = data.reduce((sum, d) => sum + Number(d.count), 0);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium text-text dark:text-text-dark">
          {label}
        </span>
        <span className="text-lg font-bold text-text dark:text-text-dark">
          {total.toLocaleString()}
        </span>
      </div>
      <div className="flex h-32 items-end gap-px">
        {data.map((d, i) => {
          const height = (Number(d.count) / maxCount) * 100;
          return (
            <div
              key={d.date || i}
              className="group relative flex-1"
              title={`${d.date}: ${d.count}`}
            >
              <div
                className={cn(
                  'w-full rounded-t transition-opacity group-hover:opacity-80',
                  color
                )}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-text px-2 py-1 text-xs text-white group-hover:block dark:bg-text-dark dark:text-text">
                {d.date}: {Number(d.count).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis labels (first and last) */}
      {data.length > 1 && (
        <div className="mt-1 flex justify-between text-xs text-text-muted dark:text-text-muted-dark">
          <span>{formatDate(data[0].date)}</span>
          <span>{formatDate(data[data.length - 1].date)}</span>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TotalCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 dark:border-border-dark dark:bg-background-dark">
      <p className="text-xs text-text-muted dark:text-text-muted-dark">
        {label}
      </p>
      <p className={cn('mt-1 text-xl font-bold', color)}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?period=${period}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const periods: { key: Period; label: string }[] = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              period === p.key
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-muted hover:text-text dark:bg-surface-hover-dark dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : data ? (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TotalCard
              label="Total Users"
              value={data.totals?.users || 0}
              color="text-blue-600 dark:text-blue-400"
            />
            <TotalCard
              label="Total Posts"
              value={data.totals?.posts || 0}
              color="text-green-600 dark:text-green-400"
            />
            <TotalCard
              label="Prayer Requests"
              value={data.totals?.prayers || 0}
              color="text-purple-600 dark:text-purple-400"
            />
            <TotalCard
              label="Total Reactions"
              value={data.totals?.reactions || 0}
              color="text-orange-600 dark:text-orange-400"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <BarChart
                data={data.user_growth}
                color="bg-blue-500"
                label="New Users"
              />
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <BarChart
                data={data.post_volume}
                color="bg-green-500"
                label="Posts"
              />
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <BarChart
                data={data.engagement}
                color="bg-orange-500"
                label="Engagement"
              />
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <BarChart
                data={data.active_users}
                color="bg-purple-500"
                label="Active Users"
              />
            </div>
          </div>

          {/* Top Content */}
          {data.top_content && data.top_content.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
              <h3 className="mb-4 font-semibold text-text dark:text-text-dark">
                Top Content
              </h3>
              <div className="space-y-3">
                {data.top_content.map((item, i) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 dark:border-border-dark dark:bg-background-dark"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        {item.author_avatar_url ? (
                          <img
                            src={item.author_avatar_url}
                            alt=""
                            className="h-5 w-5 rounded-full object-cover"
                          />
                        ) : (
                          <InitialsAvatar
                            name={item.author_name}
                            color={item.author_avatar_color}
                            size={20}
                          />
                        )}
                        <span className="text-sm font-medium text-text dark:text-text-dark">
                          {item.author_name}
                        </span>
                      </div>
                      <p className="text-sm text-text-muted dark:text-text-muted-dark">
                        {item.body.length > 120
                          ? item.body.substring(0, 120) + '...'
                          : item.body}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-text dark:text-text-dark">
                        {Number(item.total_engagement).toLocaleString()}
                      </p>
                      <p className="text-xs text-text-muted dark:text-text-muted-dark">
                        engagement
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-text-muted dark:text-text-muted-dark">
          Failed to load analytics data
        </div>
      )}
    </div>
  );
}
