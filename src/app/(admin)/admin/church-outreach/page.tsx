'use client';

import React, { Suspense, useState, lazy } from 'react';
import { cn } from '@/lib/utils/cn';
import { Loader2 } from 'lucide-react';

// Lazy-loaded tab components
const OutreachDashboard = lazy(
  () => import('@/components/admin/church-outreach/OutreachDashboard')
);
const DiscoverySearch = lazy(
  () => import('@/components/admin/church-outreach/DiscoverySearch')
);
const KanbanBoard = lazy(
  () => import('@/components/admin/church-outreach/KanbanBoard')
);
const CampaignManager = lazy(
  () => import('@/components/admin/church-outreach/CampaignManager')
);
const SequenceManager = lazy(
  () => import('@/components/admin/church-outreach/SequenceManager')
);
const ReportsView = lazy(
  () => import('@/components/admin/church-outreach/ReportsView')
);

type TabKey =
  | 'dashboard'
  | 'discovery'
  | 'pipeline'
  | 'campaigns'
  | 'sequences'
  | 'reports';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'discovery', label: 'Discovery' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'sequences', label: 'Sequences' },
  { key: 'reports', label: 'Reports' },
];

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function ChurchOutreachPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Church Outreach
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Discover, research, and manage church outreach campaigns
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
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
      <Suspense fallback={<TabSkeleton />}>
        {activeTab === 'dashboard' && <OutreachDashboard />}
        {activeTab === 'discovery' && <DiscoverySearch />}
        {activeTab === 'pipeline' && <KanbanBoard />}
        {activeTab === 'campaigns' && <CampaignManager />}
        {activeTab === 'sequences' && <SequenceManager />}
        {activeTab === 'reports' && <ReportsView />}
      </Suspense>
    </div>
  );
}
