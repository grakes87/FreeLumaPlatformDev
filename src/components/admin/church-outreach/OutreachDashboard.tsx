'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Building2,
  Mail,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Package,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineStageData {
  stage: string;
  count: number;
}

interface ReportData {
  pipeline: PipelineStageData[];
  conversion: {
    total: number;
    rate: number;
    totalRevenue: number;
  };
  email: {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    openRate: number;
    clickRate: number;
  };
  samples: {
    totalShipped: number;
    churchesWithSamples: number;
    convertedAfterSample: number;
    sampleConversionRate: number;
  };
  activityTimeline: { date: string; count: number }[];
  topEngaged: {
    church_id: number;
    church_name: string;
    opens: number;
    clicks: number;
    total_engagement: number;
  }[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new_lead: { label: 'New Lead', color: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950' },
  contacted: { label: 'Contacted', color: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950' },
  engaged: { label: 'Engaged', color: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-950' },
  sample_requested: { label: 'Sample Requested', color: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950' },
  sample_sent: { label: 'Sample Sent', color: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-950' },
  converted: { label: 'Converted', color: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-950' },
  lost: { label: 'Lost', color: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-gray-800' },
};

const STAGE_ORDER = ['new_lead', 'contacted', 'engaged', 'sample_requested', 'sample_sent', 'converted', 'lost'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OutreachDashboard() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/church-outreach/reports', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load reports');
      const json = await res.json();
      setData(json.data ?? json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Summary cards skeleton */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark"
            >
              <div className="mb-2 h-3 w-20 rounded bg-surface-hover dark:bg-surface-hover-dark" />
              <div className="h-8 w-16 rounded bg-surface-hover dark:bg-surface-hover-dark" />
            </div>
          ))}
        </div>
        {/* Funnel skeleton */}
        <div className="animate-pulse rounded-xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
          <div className="mb-4 h-4 w-32 rounded bg-surface-hover dark:bg-surface-hover-dark" />
          <div className="space-y-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-24 rounded bg-surface-hover dark:bg-surface-hover-dark" />
                <div
                  className="h-6 rounded bg-surface-hover dark:bg-surface-hover-dark"
                  style={{ width: `${80 - i * 10}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 dark:border-border-dark dark:bg-surface-dark">
        <p className="mb-4 text-text-muted dark:text-text-muted-dark">
          {error || 'No data available'}
        </p>
        <button
          onClick={fetchReports}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const totalChurches = data.pipeline.reduce((sum, s) => sum + Number(s.count), 0);
  const maxStageCount = Math.max(...data.pipeline.map((s) => Number(s.count)), 1);
  const maxActivityCount = data.activityTimeline.length > 0
    ? Math.max(...data.activityTimeline.map((d) => Number(d.count)), 1)
    : 1;

  // Build full pipeline with zero-filled stages
  const pipelineMap = new Map(data.pipeline.map((s) => [s.stage, Number(s.count)]));
  const fullPipeline = STAGE_ORDER.map((stage) => ({
    stage,
    count: pipelineMap.get(stage) || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Total Churches"
          value={totalChurches}
          icon={Building2}
          color="text-blue-600 dark:text-blue-400"
          bgColor="bg-blue-50 dark:bg-blue-950"
        />
        <SummaryCard
          label="Emails Sent"
          value={data.email.totalSent}
          icon={Mail}
          color="text-indigo-600 dark:text-indigo-400"
          bgColor="bg-indigo-50 dark:bg-indigo-950"
        />
        <SummaryCard
          label="Open Rate"
          value={`${data.email.openRate}%`}
          icon={BarChart3}
          color="text-purple-600 dark:text-purple-400"
          bgColor="bg-purple-50 dark:bg-purple-950"
        />
        <SummaryCard
          label="Conversions"
          value={data.conversion.total}
          icon={TrendingUp}
          color="text-green-600 dark:text-green-400"
          bgColor="bg-green-50 dark:bg-green-950"
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Samples Shipped"
          value={data.samples.totalShipped}
          icon={Package}
          color="text-orange-600 dark:text-orange-400"
          bgColor="bg-orange-50 dark:bg-orange-950"
        />
        <SummaryCard
          label="Sample Conversion"
          value={`${data.samples.sampleConversionRate}%`}
          icon={TrendingUp}
          color="text-amber-600 dark:text-amber-400"
          bgColor="bg-amber-50 dark:bg-amber-950"
        />
        <SummaryCard
          label="Click Rate"
          value={`${data.email.clickRate}%`}
          icon={BarChart3}
          color="text-cyan-600 dark:text-cyan-400"
          bgColor="bg-cyan-50 dark:bg-cyan-950"
        />
        <SummaryCard
          label="Total Revenue"
          value={`$${data.conversion.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="text-emerald-600 dark:text-emerald-400"
          bgColor="bg-emerald-50 dark:bg-emerald-950"
        />
      </div>

      {/* Pipeline funnel */}
      <div className="rounded-xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
          Pipeline Funnel
        </h3>
        <div className="space-y-3">
          {fullPipeline.map(({ stage, count }) => {
            const config = STAGE_CONFIG[stage] || {
              label: stage,
              color: 'bg-gray-400',
              bg: 'bg-gray-50 dark:bg-gray-800',
            };
            const pct = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0;

            return (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-right text-sm font-medium text-text dark:text-text-dark">
                  {config.label}
                </span>
                <div className={cn('flex-1 rounded-full', config.bg)} style={{ height: 24 }}>
                  <div
                    className={cn(
                      'flex h-full items-center rounded-full px-2 text-xs font-semibold text-white transition-all',
                      config.color
                    )}
                    style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }}
                  >
                    {count > 0 && <span>{count}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity timeline (30-day bar chart) */}
      {data.activityTimeline.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
            Activity Timeline (Last 30 Days)
          </h3>
          <div className="flex items-end gap-1" style={{ height: 120 }}>
            {data.activityTimeline.map((d) => {
              const barHeight = (Number(d.count) / maxActivityCount) * 100;
              return (
                <div
                  key={d.date}
                  className="group relative flex-1"
                  style={{ height: '100%' }}
                >
                  <div
                    className="absolute bottom-0 w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                    style={{ height: `${Math.max(barHeight, 2)}%` }}
                  />
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                    {d.date}: {d.count}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-text-muted dark:text-text-muted-dark">
            <span>{data.activityTimeline[0]?.date}</span>
            <span>{data.activityTimeline[data.activityTimeline.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Top engaged churches */}
      {data.topEngaged.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
            Top Engaged Churches
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left dark:border-border-dark">
                  <th className="pb-2 pr-4 font-medium text-text-muted dark:text-text-muted-dark">
                    Church
                  </th>
                  <th className="pb-2 pr-4 text-right font-medium text-text-muted dark:text-text-muted-dark">
                    Opens
                  </th>
                  <th className="pb-2 pr-4 text-right font-medium text-text-muted dark:text-text-muted-dark">
                    Clicks
                  </th>
                  <th className="pb-2 text-right font-medium text-text-muted dark:text-text-muted-dark">
                    Engagement
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topEngaged.map((church) => (
                  <tr
                    key={church.church_id}
                    className="border-b border-border/50 dark:border-border-dark/50"
                  >
                    <td className="py-2 pr-4 font-medium text-text dark:text-text-dark">
                      {church.church_name}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-muted dark:text-text-muted-dark">
                      {church.opens}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-muted dark:text-text-muted-dark">
                      {church.clicks}
                    </td>
                    <td className="py-2 text-right font-semibold text-primary">
                      {church.total_engagement}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card sub-component
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', bgColor)}>
          <Icon className={cn('h-5 w-5', color)} />
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted dark:text-text-muted-dark">
            {label}
          </p>
          <p className="text-xl font-bold text-text dark:text-text-dark">{value}</p>
        </div>
      </div>
    </div>
  );
}
