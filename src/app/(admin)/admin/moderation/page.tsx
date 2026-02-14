'use client';

import { useState, lazy, Suspense } from 'react';
import { cn } from '@/lib/utils/cn';
import { Shield, Users, Ban, ScrollText, BarChart3 } from 'lucide-react';
import { ModerationQueue } from '@/components/admin/ModerationQueue';

const UserBrowser = lazy(() =>
  import('@/components/admin/UserBrowser').then((m) => ({ default: m.UserBrowser }))
);
const BanManager = lazy(() =>
  import('@/components/admin/BanManager').then((m) => ({ default: m.BanManager }))
);
const AuditLog = lazy(() =>
  import('@/components/admin/AuditLog').then((m) => ({ default: m.AuditLog }))
);
const ModerationStats = lazy(() =>
  import('@/components/admin/ModerationStats').then((m) => ({ default: m.ModerationStats }))
);

type TabKey = 'queue' | 'users' | 'bans' | 'audit' | 'stats';

const TABS: { key: TabKey; label: string; icon: typeof Shield }[] = [
  { key: 'queue', label: 'Queue', icon: Shield },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'bans', label: 'Bans', icon: Ban },
  { key: 'audit', label: 'Audit Log', icon: ScrollText },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
];

function TabFallback() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('queue');

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Content Moderation
        </h1>
        <p className="text-text-muted dark:text-text-muted-dark">
          Review reports, manage users, and track moderation activity.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
                  : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'queue' && <ModerationQueue />}

      {activeTab === 'users' && (
        <Suspense fallback={<TabFallback />}>
          <UserBrowser />
        </Suspense>
      )}

      {activeTab === 'bans' && (
        <Suspense fallback={<TabFallback />}>
          <BanManager />
        </Suspense>
      )}

      {activeTab === 'audit' && (
        <Suspense fallback={<TabFallback />}>
          <AuditLog />
        </Suspense>
      )}

      {activeTab === 'stats' && (
        <Suspense fallback={<TabFallback />}>
          <ModerationStats />
        </Suspense>
      )}
    </div>
  );
}
