'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { HostDashboard, type DashboardData } from '@/components/workshop/HostDashboard';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export default function WorkshopDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    let cancelled = false;

    async function fetchDashboard() {
      try {
        const res = await fetch('/api/workshops/dashboard');
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error || 'Failed to load dashboard');
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
          setLoading(false);
        }
      }
    }

    fetchDashboard();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  // Loading skeleton
  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton width={32} height={32} className="rounded-full" />
          <Skeleton width={180} height={24} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={80} className="w-full rounded-2xl" />
          ))}
        </div>
        <div className="mt-6">
          <Skeleton height={200} className="w-full rounded-2xl" />
        </div>
        <div className="mt-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={56} className="w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full p-1.5 text-text transition-colors hover:bg-slate-100 dark:text-text-dark dark:hover:bg-slate-800"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-text dark:text-text-dark">
            Host Dashboard
          </h1>
        </div>
        <Card padding="lg">
          <p className="text-center text-sm text-red-500">{error}</p>
        </Card>
      </div>
    );
  }

  // Empty state (user hasn't hosted any workshops)
  const isEmpty =
    data &&
    data.stats.totalWorkshops === 0 &&
    data.upcomingWorkshops.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full p-1.5 text-text transition-colors hover:bg-slate-100 dark:text-text-dark dark:hover:bg-slate-800"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-text dark:text-text-dark">
            Host Dashboard
          </h1>
        </div>
        <Link
          href="/workshops/create"
          className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New Workshop
        </Link>
      </div>

      {isEmpty ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Calendar className="h-12 w-12 text-text-muted/50 dark:text-text-muted-dark/50" />
            <h2 className="text-lg font-semibold text-text dark:text-text-dark">
              No workshops yet
            </h2>
            <p className="max-w-xs text-sm text-text-muted dark:text-text-muted-dark">
              You haven&apos;t hosted any workshops yet. Create your first one
              to start building your community.
            </p>
            <Link
              href="/workshops/create"
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Workshop
            </Link>
          </div>
        </Card>
      ) : (
        data && <HostDashboard data={data} />
      )}
    </div>
  );
}
