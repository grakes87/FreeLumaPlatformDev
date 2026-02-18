'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { workshopLabel } from '@/lib/utils/workshopLabel';
import { CreateWorkshopForm } from '@/components/workshop/CreateWorkshopForm';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export default function CreateWorkshopPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const wl = workshopLabel(user?.mode);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton width={32} height={32} className="rounded-full" />
          <Skeleton width={160} height={24} />
        </div>
        {/* Form skeleton */}
        <div className="space-y-4">
          <Skeleton height={48} className="w-full" />
          <Skeleton height={96} className="w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
          <Skeleton height={48} className="w-full" />
          <Skeleton height={48} className="w-full" />
        </div>
      </div>
    );
  }

  // User can't host
  if (user && !user.can_host) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full p-1.5 text-text transition-colors hover:bg-slate-100 dark:text-text-dark dark:hover:bg-slate-800"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-text dark:text-text-dark">
            Create {wl.singular}
          </h1>
        </div>

        <Card padding="lg">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <ShieldAlert className="h-12 w-12 text-amber-500" />
            <h2 className="text-lg font-semibold text-text dark:text-text-dark">
              Hosting Not Available
            </h2>
            <p className="text-sm text-text-muted dark:text-text-muted-dark">
              Your hosting privileges have been revoked. Contact support if you
              believe this is an error.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-full p-1.5 text-text transition-colors hover:bg-slate-100 dark:text-text-dark dark:hover:bg-slate-800"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-text dark:text-text-dark">
          Create {wl.singular}
        </h1>
      </div>

      {/* Form */}
      <CreateWorkshopForm
        mode="create"
        onSuccess={(workshop) => {
          router.push(`/workshops/${workshop.id}`);
        }}
      />
    </div>
  );
}
