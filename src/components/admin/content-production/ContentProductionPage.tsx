'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { MonthSelector } from './MonthSelector';
import { StatsHeader, type ContentStats } from './StatsHeader';
import { UnassignedTab } from './UnassignedTab';
import { PendingTab } from './PendingTab';
import type { DayData } from './DayCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'unassigned' | 'assigned' | 'pending' | 'completed' | 'background';

interface MonthData {
  stats: ContentStats;
  days: DayData[];
}

// ---------------------------------------------------------------------------
// Tabs configuration
// ---------------------------------------------------------------------------

const TABS: { key: TabKey; label: string }[] = [
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'background', label: 'Background Videos' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ContentProductionPage() {
  const toast = useToast();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [selectedMode, setSelectedMode] = useState<'bible' | 'positivity'>('bible');
  const [activeTab, setActiveTab] = useState<TabKey>('unassigned');

  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch month overview
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: selectedMonth,
        mode: selectedMode,
      });
      const res = await fetch(`/api/admin/content-production?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? json);
      } else {
        toast.error('Failed to load content production data');
        setData(null);
      }
    } catch {
      toast.error('Failed to load content production data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedMode, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle field regeneration
  const handleRegenerate = useCallback(
    async (dayId: number, field: string) => {
      try {
        const res = await fetch('/api/admin/content-production/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ daily_content_id: dayId, field }),
        });
        if (res.ok) {
          toast.success(`Regenerated ${field.replace(/_/g, ' ')}`);
          fetchData();
        } else {
          const err = await res.json();
          toast.error(err.error || 'Regeneration failed');
        }
      } catch {
        toast.error('Regeneration failed');
      }
    },
    [fetchData, toast]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Content Production
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Manage daily content generation, creator assignments, and approvals
        </p>
      </div>

      {/* Controls: month selector + mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <MonthSelector month={selectedMonth} onChange={setSelectedMonth} />

        <div className="flex gap-1 rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
          {(['bible', 'positivity'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors',
                selectedMode === mode
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Stats header */}
      <StatsHeader stats={data?.stats ?? null} loading={loading} />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === t.key
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {activeTab === 'unassigned' && (
            <UnassignedTab
              days={data?.days ?? []}
              month={selectedMonth}
              mode={selectedMode}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'assigned' && (
            <PlaceholderTab label="Assigned" description="Days assigned to creators (coming in a future plan)" />
          )}
          {activeTab === 'pending' && (
            <PendingTab
              days={data?.days ?? []}
              mode={selectedMode}
              onRegenerate={handleRegenerate}
            />
          )}
          {activeTab === 'completed' && (
            <PlaceholderTab label="Completed" description="Approved content (coming in a future plan)" />
          )}
          {activeTab === 'background' && (
            <PlaceholderTab label="Background Videos" description="Background video management (coming in a future plan)" />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder for tabs that are not yet implemented
// ---------------------------------------------------------------------------

function PlaceholderTab({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
      <p className="text-lg font-medium text-text dark:text-text-dark">{label}</p>
      <p className="text-sm text-text-muted dark:text-text-muted-dark">{description}</p>
    </div>
  );
}
