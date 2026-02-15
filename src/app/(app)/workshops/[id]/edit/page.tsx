'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  CreateWorkshopForm,
  type WorkshopFormData,
} from '@/components/workshop/CreateWorkshopForm';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

interface WorkshopDetail {
  id: number;
  title: string;
  description: string | null;
  category_id: number | null;
  scheduled_at: string;
  duration_minutes: number | null;
  is_private: boolean;
  max_capacity: number | null;
  host_id: number;
  status: string;
}

interface EditWorkshopPageProps {
  params: Promise<{ id: string }>;
}

export default function EditWorkshopPage({ params }: EditWorkshopPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [workshop, setWorkshop] = useState<WorkshopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workshopId = parseInt(id, 10);

  useEffect(() => {
    if (authLoading || isNaN(workshopId)) return;

    async function fetchWorkshop() {
      try {
        const res = await fetch(`/api/workshops/${workshopId}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          if (res.status === 404) {
            setError('Workshop not found');
          } else {
            setError('Failed to load workshop');
          }
          return;
        }
        const data = await res.json();
        const w = data.workshop;

        // Check if user is the host
        if (!user || w.host_id !== user.id) {
          setError('Only the host can edit this workshop');
          return;
        }

        // Check workshop status
        if (w.status !== 'scheduled') {
          setError(
            `This workshop cannot be edited because it is ${w.status}`
          );
          return;
        }

        setWorkshop(w);
      } catch {
        setError('Something went wrong while loading the workshop');
      } finally {
        setLoading(false);
      }
    }

    fetchWorkshop();
  }, [workshopId, authLoading, user]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton width={32} height={32} className="rounded-full" />
          <Skeleton width={140} height={24} />
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

  if (error) {
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
            Edit Workshop
          </h1>
        </div>

        <Card padding="lg">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <h2 className="text-lg font-semibold text-text dark:text-text-dark">
              Cannot Edit Workshop
            </h2>
            <p className="text-sm text-text-muted dark:text-text-muted-dark">
              {error}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (!workshop) return null;

  // Parse scheduled_at into date and time for the form
  const scheduledDate = new Date(workshop.scheduled_at);
  const dateStr = scheduledDate.toISOString().split('T')[0];
  // Format time as HH:MM in local timezone
  const timeStr = scheduledDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const initialData: Partial<WorkshopFormData> = {
    title: workshop.title,
    description: workshop.description ?? '',
    category_id: workshop.category_id,
    date: dateStr,
    time: timeStr,
    duration_minutes: workshop.duration_minutes,
    is_private: workshop.is_private,
    max_capacity: workshop.max_capacity,
  };

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
          Edit Workshop
        </h1>
      </div>

      {/* Form */}
      <CreateWorkshopForm
        mode="edit"
        workshopId={workshopId}
        initialData={initialData}
        onSuccess={() => {
          router.push(`/workshops/${workshopId}`);
        }}
      />
    </div>
  );
}
