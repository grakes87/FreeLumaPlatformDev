'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { WorkshopDetail } from '@/components/workshop/WorkshopDetail';
import type { WorkshopData, RsvpData } from '@/components/workshop/WorkshopDetail';
import { Skeleton, SkeletonText, SkeletonCircle } from '@/components/ui/Skeleton';

export default function WorkshopDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [workshop, setWorkshop] = useState<WorkshopData | null>(null);
  const [userRsvp, setUserRsvp] = useState<RsvpData | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchWorkshop = useCallback(async () => {
    try {
      const res = await fetch(`/api/workshops/${params.id}`, {
        credentials: 'include',
      });

      if (res.status === 404) {
        setNotFound(true);
        return;
      }

      if (!res.ok) {
        setNotFound(true);
        return;
      }

      const json = await res.json();
      const data = json.data ?? json;

      setWorkshop(data.workshop);
      setUserRsvp(data.userRsvp ?? null);
      setIsHost(data.isHost ?? false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchWorkshop();
  }, [fetchWorkshop]);

  // Loading skeleton
  if (loading) {
    return <WorkshopDetailSkeleton />;
  }

  // Not found
  if (notFound || !workshop) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-white/10">
          <Calendar className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-text dark:text-text-dark">
          Workshop Not Found
        </h2>
        <p className="mt-1.5 text-sm text-text-muted dark:text-text-muted-dark">
          This workshop may have been removed or is not available.
        </p>
        <button
          type="button"
          onClick={() => router.push('/workshops')}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-white"
        >
          Back to Workshops
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-7.5rem)]">
      {/* Top bar with back button */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90">
        <button
          type="button"
          onClick={() => router.push('/workshops')}
          className="rounded-lg p-1 text-text-muted transition-colors hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-800"
          aria-label="Back to workshops"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-lg font-semibold text-text dark:text-text-dark">
          {workshop.title}
        </h1>
      </div>

      <WorkshopDetail
        workshop={workshop}
        userRsvp={userRsvp}
        isHost={isHost}
      />
    </div>
  );
}

// ---- Skeleton ----

function WorkshopDetailSkeleton() {
  return (
    <div className="min-h-[calc(100vh-7.5rem)]">
      {/* Top bar skeleton */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/90">
        <Skeleton width={24} height={24} className="rounded" />
        <Skeleton width={180} height={22} />
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4">
        {/* Category badge */}
        <Skeleton width={80} height={22} className="mb-2 rounded-full" />

        {/* Title */}
        <Skeleton width="80%" height={28} className="mb-2" />

        {/* Status badges */}
        <div className="flex gap-2">
          <Skeleton width={80} height={22} className="rounded-full" />
        </div>

        {/* Host section */}
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-3">
            <SkeletonCircle size={48} />
            <div className="flex-1 space-y-2">
              <Skeleton width={120} height={16} />
              <Skeleton width={90} height={14} />
            </div>
          </div>
        </div>

        {/* Schedule section */}
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton width={20} height={20} className="rounded" />
              <Skeleton width={220} height={14} />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton width={20} height={20} className="rounded" />
              <Skeleton width={150} height={14} />
            </div>
          </div>
        </div>

        {/* Description section */}
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <Skeleton width={60} height={12} className="mb-3" />
          <SkeletonText lines={4} />
        </div>

        {/* Attendees section */}
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-2">
            <Skeleton width={20} height={20} className="rounded" />
            <Skeleton width={100} height={14} />
          </div>
        </div>
      </div>
    </div>
  );
}
