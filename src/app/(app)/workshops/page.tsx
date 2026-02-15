'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Radio, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { WorkshopCard } from '@/components/workshop/WorkshopCard';
import {
  WorkshopFilters,
  type WorkshopTab,
  type WorkshopCategoryItem,
} from '@/components/workshop/WorkshopFilters';
import { EmptyState } from '@/components/common/EmptyState';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonCircle } from '@/components/ui/Skeleton';

function WorkshopCardSkeleton() {
  return (
    <Card padding="md">
      <div className="mb-2 flex items-center gap-2">
        <Skeleton height={20} className="w-16" />
        <Skeleton height={20} className="w-20" />
      </div>
      <Skeleton height={18} className="w-3/4" />
      <Skeleton height={14} className="mt-1 w-1/2" />
      <div className="mt-2 flex items-center gap-2">
        <SkeletonCircle size={24} />
        <Skeleton height={14} className="w-24" />
      </div>
      <div className="mt-3 flex gap-4">
        <Skeleton height={12} className="w-32" />
        <Skeleton height={12} className="w-16" />
        <Skeleton height={12} className="w-20" />
      </div>
    </Card>
  );
}

export default function WorkshopsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<WorkshopTab>('upcoming');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<WorkshopCategoryItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Build options from current filter state
  const options = useMemo(() => {
    const opts: {
      category?: number;
      past?: boolean;
      my?: boolean;
    } = {};

    if (categoryId) opts.category = categoryId;
    if (tab === 'past') opts.past = true;
    if (tab === 'my') opts.my = true;

    return opts;
  }, [tab, categoryId]);

  const {
    workshops,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
  } = useWorkshops(options);

  const { ref: scrollRef, inView } = useInfiniteScroll();

  // Infinite scroll trigger
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMore();
    }
  }, [inView, hasMore, isLoading, loadMore]);

  // Fetch categories
  useEffect(() => {
    let cancelled = false;

    async function fetchCategories() {
      try {
        setCategoriesLoading(true);
        const res = await fetch('/api/workshops/categories', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setCategories(data.categories ?? []);
          }
        }
      } catch (err) {
        console.error('[WorkshopsPage] Failed to fetch categories:', err);
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    }

    fetchCategories();
    return () => { cancelled = true; };
  }, []);

  const handleTabChange = useCallback((newTab: WorkshopTab) => {
    setTab(newTab);
    // Reset category when switching tabs
    setCategoryId(null);
  }, []);

  const handleCategoryChange = useCallback((id: number | null) => {
    setCategoryId(id);
  }, []);

  // Empty state messages per tab
  const getEmptyState = () => {
    switch (tab) {
      case 'upcoming':
        return {
          title: 'No upcoming workshops',
          description: 'Check back soon for new workshops, or host your own!',
        };
      case 'past':
        return {
          title: 'No past workshops',
          description: 'Past workshops will appear here once they end.',
        };
      case 'my':
        return {
          title: 'No workshops yet',
          description: "Workshops you're hosting or attending will appear here.",
        };
    }
  };

  return (
    <div className="min-h-[calc(100vh-7.5rem)] px-4 py-4">
      {/* Page header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text dark:text-white">
          Workshops
        </h1>
        <Link
          href="/workshops/create"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Host
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <WorkshopFilters
          tab={tab}
          onTabChange={handleTabChange}
          categoryId={categoryId}
          onCategoryChange={handleCategoryChange}
          categories={categories}
          categoriesLoading={categoriesLoading}
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:bg-red-500/20 dark:text-red-400">
          {error}
          <button
            onClick={refresh}
            className="ml-2 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Workshop list */}
      {isLoading && workshops.length === 0 ? (
        <div className="space-y-3">
          <WorkshopCardSkeleton />
          <WorkshopCardSkeleton />
          <WorkshopCardSkeleton />
        </div>
      ) : workshops.length === 0 ? (
        <EmptyState
          icon={<Radio className="h-12 w-12" />}
          title={getEmptyState().title}
          description={getEmptyState().description}
          action={
            tab === 'upcoming' ? (
              <Link
                href="/workshops/create"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Host a Workshop
              </Link>
            ) : undefined
          }
          className="min-h-[40vh]"
        />
      ) : (
        <div className="space-y-3">
          {workshops.map((workshop) => (
            <WorkshopCard
              key={workshop.id}
              workshop={workshop}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={scrollRef} className="h-1" />

          {/* Loading more indicator */}
          {isLoading && workshops.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted/40 dark:text-white/40" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
