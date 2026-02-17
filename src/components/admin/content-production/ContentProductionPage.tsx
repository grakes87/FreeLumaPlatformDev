'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { MonthSelector } from './MonthSelector';
import { StatsHeader, type ContentStats } from './StatsHeader';
import { UnassignedTab } from './UnassignedTab';
import { AssignedTab } from './AssignedTab';
import { PendingTab } from './PendingTab';
import { CompletedTab } from './CompletedTab';
import { BackgroundVideosTab } from './BackgroundVideosTab';
import { CreatorManager } from './CreatorManager';
import PlatformSettingsSection from './PlatformSettingsSection';
import type { DayData } from './DayCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'unassigned' | 'assigned' | 'pending' | 'completed' | 'background';

interface Creator {
  id: number;
  name: string;
  user_id: number;
  user?: {
    id: number;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
  } | null;
  monthly_capacity: number;
  can_bible: boolean;
  can_positivity: boolean;
  active: boolean;
}

interface MonthData {
  stats: ContentStats;
  days: DayData[];
  creators?: Creator[];
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

  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showCreators, setShowCreators] = useState(false);

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

  const creators = data?.creators ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text-dark">
            Content Production
          </h1>
          <p className="text-text-muted dark:text-text-muted-dark">
            Manage daily content generation, creator assignments, and approvals
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCreators(true)}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-surface-hover-dark"
            title="Manage Creators"
          >
            <Users className="h-4 w-4" />
            Creators
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-surface-hover-dark"
            title="Pipeline Settings"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
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
            <AssignedTab
              days={data?.days ?? []}
              month={selectedMonth}
              mode={selectedMode}
              creators={creators}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'pending' && (
            <PendingTab
              days={data?.days ?? []}
              mode={selectedMode}
              onRegenerate={handleRegenerate}
            />
          )}
          {activeTab === 'completed' && (
            <CompletedTab
              days={data?.days ?? []}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'background' && (
            <BackgroundVideosTab
              days={data?.days ?? []}
              month={selectedMonth}
              onRefresh={fetchData}
            />
          )}
        </>
      )}

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Pipeline Settings"
        size="lg"
      >
        <PlatformSettingsSection />
      </Modal>

      {/* Creators Modal */}
      <Modal
        isOpen={showCreators}
        onClose={() => setShowCreators(false)}
        title="Content Creators"
        size="xl"
      >
        <CreatorManager onCreatorChange={fetchData} />
      </Modal>
    </div>
  );
}
