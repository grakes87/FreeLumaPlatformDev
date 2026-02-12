'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FileText,
  AlertTriangle,
  Flag,
  Activity,
  Shield,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface AnalyticsData {
  user_growth: Array<{ date: string; count: number }>;
  totals: {
    users: number;
    posts: number;
    prayers: number;
    reactions: number;
  };
  active_users: Array<{ date: string; count: number }>;
}

interface FlaggedData {
  flagged_posts: number;
  flagged_comments: number;
  pending_reports: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const content = (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface p-5 transition-colors dark:border-border-dark dark:bg-surface-dark',
        href && 'hover:border-primary/30 hover:shadow-sm cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-text dark:text-text-dark">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        <div className={cn('rounded-xl p-2.5', color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function MiniBarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-text-muted dark:text-text-muted-dark">
        No data yet
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => Number(d.count)), 1);

  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((d, i) => {
        const height = (Number(d.count) / maxCount) * 100;
        return (
          <div
            key={d.date || i}
            className="group relative flex-1"
            title={`${d.date}: ${d.count}`}
          >
            <div
              className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(height, 2)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [flagged, setFlagged] = useState<FlaggedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/analytics?period=7d', { credentials: 'include' }).then(
        (r) => r.json()
      ),
      fetch('/api/admin/flagged', { credentials: 'include' }).then((r) =>
        r.json()
      ),
    ])
      .then(([analyticsData, flaggedData]) => {
        setAnalytics(analyticsData);
        setFlagged(flaggedData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const pendingTotal =
    (flagged?.pending_reports || 0) +
    (flagged?.flagged_posts || 0) +
    (flagged?.flagged_comments || 0);

  // Compute active users in last 7 days
  const activeUsersCount =
    analytics?.active_users && analytics.active_users.length > 0
      ? Math.max(...analytics.active_users.map((d) => Number(d.count)))
      : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Dashboard
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Welcome to the Free Luma admin panel.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Users"
          value={analytics?.totals?.users || 0}
          icon={Users}
          color="bg-blue-500"
        />
        <StatCard
          label="Total Posts"
          value={analytics?.totals?.posts || 0}
          icon={FileText}
          color="bg-green-500"
        />
        <StatCard
          label="Pending Reports"
          value={pendingTotal}
          icon={AlertTriangle}
          color={pendingTotal > 0 ? 'bg-red-500' : 'bg-gray-400'}
          href="/admin/moderation"
        />
        <StatCard
          label="Flagged Content"
          value={
            (flagged?.flagged_posts || 0) + (flagged?.flagged_comments || 0)
          }
          icon={Flag}
          color="bg-orange-500"
          href="/admin/moderation"
        />
        <StatCard
          label="Active Users (7d)"
          value={activeUsersCount}
          icon={Activity}
          color="bg-purple-500"
        />
      </div>

      {/* User Growth Chart */}
      <div className="rounded-2xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
        <h3 className="mb-4 font-semibold text-text dark:text-text-dark">
          New Users (Last 7 Days)
        </h3>
        <MiniBarChart data={analytics?.user_growth || []} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/admin/moderation"
          className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/30 hover:shadow-sm dark:border-border-dark dark:bg-surface-dark"
        >
          <div className="rounded-xl bg-red-500/10 p-3">
            <Shield className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-text dark:text-text-dark">
              Review Reports
            </p>
            <p className="text-sm text-text-muted dark:text-text-muted-dark">
              {pendingTotal > 0
                ? `${pendingTotal} items need review`
                : 'All clear'}
            </p>
          </div>
        </Link>
        <Link
          href="/admin/settings"
          className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/30 hover:shadow-sm dark:border-border-dark dark:bg-surface-dark"
        >
          <div className="rounded-xl bg-blue-500/10 p-3">
            <Settings className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <p className="font-semibold text-text dark:text-text-dark">
              Platform Settings
            </p>
            <p className="text-sm text-text-muted dark:text-text-muted-dark">
              Configure feed style, moderation, registration
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
