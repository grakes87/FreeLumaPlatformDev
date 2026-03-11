'use client';

import React, { Suspense, useState, useEffect, lazy } from 'react';
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
const SequenceManager = lazy(
  () => import('@/components/admin/church-outreach/SequenceManager')
);
const ReviewQueue = lazy(
  () => import('@/components/admin/church-outreach/ReviewQueue')
);
const AutoDiscoveryConfig = lazy(
  () => import('@/components/admin/church-outreach/AutoDiscoveryConfig')
);
const TemplateManager = lazy(
  () => import('@/components/admin/church-outreach/TemplateManager')
);
const SamplesTab = lazy(
  () => import('@/components/admin/church-outreach/SamplesTab')
);
const UnsubscribedTab = lazy(
  () => import('@/components/admin/church-outreach/UnsubscribedTab')
);

type TabKey =
  | 'dashboard'
  | 'discovery'
  | 'pipeline'
  | 'sequences'
  | 'templates'
  | 'review'
  | 'samples'
  | 'unsubscribed';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'discovery', label: 'Discovery' },
  { key: 'review', label: 'Review Queue' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'samples', label: 'Samples' },
  { key: 'unsubscribed', label: 'Unsubscribed' },
  { key: 'templates', label: 'Templates' },
  { key: 'sequences', label: 'Sequences' },
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
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    fetch('/api/admin/church-outreach/review?page=1&limit=1', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.total) setReviewCount(data.total); })
      .catch(() => {});
  }, [activeTab]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Church Outreach
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Discover, research, and manage church outreach
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
            {t.key === 'review' && reviewCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                {reviewCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Suspense fallback={<TabSkeleton />}>
        {activeTab === 'dashboard' && <OutreachDashboard />}
        {activeTab === 'discovery' && (
          <>
            <AutoDiscoveryConfig />
            <DiscoverySearch />
          </>
        )}
        {activeTab === 'pipeline' && <KanbanBoard />}
        {activeTab === 'templates' && <TemplateManager />}
        {activeTab === 'sequences' && <SequenceManager />}
        {activeTab === 'review' && <ReviewQueue />}
        {activeTab === 'samples' && <SamplesTab />}
        {activeTab === 'unsubscribed' && <UnsubscribedTab />}
      </Suspense>
    </div>
  );
}
