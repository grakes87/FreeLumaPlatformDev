'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  RefreshCw,
  Building2,
  Package,
  TrendingUp,
  DollarSign,
  Mail,
  Eye,
  MousePointerClick,
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
  activityTimeline: Array<{ date: string; count: number }>;
  topEngaged: Array<{
    church_id: number;
    church_name: string;
    opens: number;
    clicks: number;
    total_engagement: number;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  engaged: 'Engaged',
  sample_requested: 'Sample Requested',
  sample_sent: 'Sample Sent',
  converted: 'Converted',
  lost: 'Lost',
};

const STAGE_COLORS: Record<string, string> = {
  new_lead: 'bg-gray-400',
  contacted: 'bg-blue-400',
  engaged: 'bg-indigo-400',
  sample_requested: 'bg-amber-400',
  sample_sent: 'bg-orange-400',
  converted: 'bg-green-500',
  lost: 'bg-red-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportsView() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/church-outreach/reports', {
          credentials: 'include', credentials: 'include' });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
        <p className="text-sm text-red-600 dark:text-red-400">{error || 'No data available'}</p>
        <button onClick={fetchReports} className="mt-2 text-sm text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const totalChurches = data.pipeline.reduce((s, p) => s + Number(p.count), 0);
  const maxActivity = Math.max(...data.activityTimeline.map((d) => Number(d.count)), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text dark:text-text-dark">Reports</h3>
        <button
          onClick={fetchReports}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-text-muted transition-colors hover:text-text dark:border-border-dark dark:text-text-muted-dark dark:hover:text-text-dark"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Building2 className="mb-1 h-5 w-5 text-blue-500" />
          <p className="text-2xl font-bold text-text dark:text-text-dark">{totalChurches}</p>
          <p className="text-xs text-text-muted dark:text-text-muted-dark">Total Churches</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Package className="mb-1 h-5 w-5 text-orange-500" />
          <p className="text-2xl font-bold text-text dark:text-text-dark">{data.samples.totalShipped}</p>
          <p className="text-xs text-text-muted dark:text-text-muted-dark">Samples Shipped</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <TrendingUp className="mb-1 h-5 w-5 text-green-500" />
          <p className="text-2xl font-bold text-text dark:text-text-dark">{data.conversion.total}</p>
          <p className="text-xs text-text-muted dark:text-text-muted-dark">
            Conversions ({data.conversion.rate}%)
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <DollarSign className="mb-1 h-5 w-5 text-emerald-500" />
          <p className="text-2xl font-bold text-text dark:text-text-dark">
            ${data.conversion.totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-text-muted dark:text-text-muted-dark">Revenue Estimate</p>
        </div>
      </div>

      {/* Pipeline funnel */}
      <div className="rounded-xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
        <h4 className="mb-3 text-sm font-semibold text-text dark:text-text-dark">Pipeline Funnel</h4>
        <div className="space-y-2">
          {data.pipeline.map((stage) => {
            const pct = totalChurches > 0 ? (Number(stage.count) / totalChurches) * 100 : 0;
            return (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-right text-xs text-text-muted dark:text-text-muted-dark">
                  {STAGE_LABELS[stage.stage] || stage.stage}
                </span>
                <div className="relative h-6 flex-1 rounded-full bg-surface-hover dark:bg-surface-hover-dark">
                  <div
                    className={cn('h-full rounded-full transition-all', STAGE_COLORS[stage.stage] || 'bg-gray-400')}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
                <span className="w-12 text-right text-xs font-medium text-text dark:text-text-dark">
                  {stage.count}
                </span>
              </div>
            );
          })}
          {data.pipeline.length === 0 && (
            <p className="py-4 text-center text-sm text-text-muted dark:text-text-muted-dark">
              No churches in pipeline yet
            </p>
          )}
        </div>
      </div>

      {/* Email performance */}
      <div className="rounded-xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
        <h4 className="mb-3 text-sm font-semibold text-text dark:text-text-dark">Email Performance</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <Mail className="mx-auto mb-1 h-5 w-5 text-blue-500" />
            <p className="text-xl font-bold text-text dark:text-text-dark">{data.email.totalSent}</p>
            <p className="text-xs text-text-muted dark:text-text-muted-dark">Sent</p>
          </div>
          <div className="text-center">
            <Eye className="mx-auto mb-1 h-5 w-5 text-purple-500" />
            <p className="text-xl font-bold text-text dark:text-text-dark">
              {data.email.openRate}%
            </p>
            <p className="text-xs text-text-muted dark:text-text-muted-dark">
              Open Rate ({data.email.totalOpened})
            </p>
          </div>
          <div className="text-center">
            <MousePointerClick className="mx-auto mb-1 h-5 w-5 text-green-500" />
            <p className="text-xl font-bold text-text dark:text-text-dark">
              {data.email.clickRate}%
            </p>
            <p className="text-xs text-text-muted dark:text-text-muted-dark">
              Click Rate ({data.email.totalClicked})
            </p>
          </div>
        </div>
      </div>

      {/* Sample metrics */}
      <div className="rounded-xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
        <h4 className="mb-3 text-sm font-semibold text-text dark:text-text-dark">Sample Metrics</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-bold text-text dark:text-text-dark">{data.samples.churchesWithSamples}</p>
            <p className="text-xs text-text-muted dark:text-text-muted-dark">Churches Sampled</p>
          </div>
          <div>
            <p className="text-xl font-bold text-text dark:text-text-dark">{data.samples.convertedAfterSample}</p>
            <p className="text-xs text-text-muted dark:text-text-muted-dark">Converted After Sample</p>
          </div>
          <div>
            <p className="text-xl font-bold text-text dark:text-text-dark">{data.samples.sampleConversionRate}%</p>
            <p className="text-xs text-text-muted dark:text-text-muted-dark">Sample Conversion Rate</p>
          </div>
        </div>
      </div>

      {/* Activity timeline */}
      {data.activityTimeline.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
          <h4 className="mb-3 text-sm font-semibold text-text dark:text-text-dark">Activity (Last 30 Days)</h4>
          <div className="flex items-end gap-0.5" style={{ height: 80 }}>
            {data.activityTimeline.map((d) => {
              const pct = (Number(d.count) / maxActivity) * 100;
              return (
                <div
                  key={d.date}
                  className="group relative flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                  title={`${d.date}: ${d.count} activities`}
                >
                  <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {d.count}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
              {data.activityTimeline[0]?.date}
            </span>
            <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
              {data.activityTimeline[data.activityTimeline.length - 1]?.date}
            </span>
          </div>
        </div>
      )}

      {/* Top engaged churches */}
      {data.topEngaged.length > 0 && (
        <div className="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
          <div className="border-b border-border px-5 py-3 dark:border-border-dark">
            <h4 className="text-sm font-semibold text-text dark:text-text-dark">Top Engaged Churches</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left dark:border-border-dark">
                  <th className="px-5 py-2 font-medium text-text-muted dark:text-text-muted-dark">Church</th>
                  <th className="px-4 py-2 text-right font-medium text-text-muted dark:text-text-muted-dark">Opens</th>
                  <th className="px-4 py-2 text-right font-medium text-text-muted dark:text-text-muted-dark">Clicks</th>
                  <th className="px-4 py-2 text-right font-medium text-text-muted dark:text-text-muted-dark">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.topEngaged.map((c) => (
                  <tr key={c.church_id} className="border-b border-border/50 dark:border-border-dark/50">
                    <td className="px-5 py-2 font-medium text-text dark:text-text-dark">{c.church_name}</td>
                    <td className="px-4 py-2 text-right text-text-muted dark:text-text-muted-dark">{c.opens}</td>
                    <td className="px-4 py-2 text-right text-text-muted dark:text-text-muted-dark">{c.clicks}</td>
                    <td className="px-4 py-2 text-right font-medium text-text dark:text-text-dark">{c.total_engagement}</td>
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

export { ReportsView };
