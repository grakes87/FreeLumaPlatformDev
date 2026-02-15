'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useImmersive } from '@/context/ImmersiveContext';

// ---------------------------------------------------------------------------
// CRITICAL: Dynamic import with ssr:false
// Agora SDK accesses `window` and `navigator` on import.
// Without ssr:false, Next.js SSR will crash.
// ---------------------------------------------------------------------------
const WorkshopRoom = dynamic(
  () => import('@/components/workshop/WorkshopRoom'),
  {
    ssr: false,
    loading: () => <WorkshopLoadingScreen />,
  }
);

/**
 * Live workshop room page at /workshops/[id]/live.
 * Full-screen immersive layout that hides the bottom nav.
 * Uses dynamic import (ssr:false) to safely load Agora SDK.
 */
export default function WorkshopLivePage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { setImmersive } = useImmersive();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const workshopId = parseInt(params.id, 10);

  // Set immersive mode to hide bottom nav
  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  const handleExit = useCallback(() => {
    if (isLive) {
      setShowExitConfirm(true);
    } else {
      router.push(`/workshops/${workshopId}`);
    }
  }, [isLive, router, workshopId]);

  const confirmExit = useCallback(() => {
    setShowExitConfirm(false);
    router.push(`/workshops/${workshopId}`);
  }, [router, workshopId]);

  if (isNaN(workshopId)) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <p className="text-white">Invalid workshop ID</p>
          <button
            type="button"
            onClick={() => router.push('/workshops')}
            className="mt-3 text-sm text-primary"
          >
            Back to workshops
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-gray-950">
      <WorkshopRoom
        workshopId={workshopId}
        onExit={handleExit}
        onLiveStateChange={setIsLive}
      />

      {/* Exit confirmation dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Leave Workshop?
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              The workshop is currently live. Are you sure you want to leave?
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={confirmExit}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading screen (shown while dynamic import resolves)
// ---------------------------------------------------------------------------

function WorkshopLoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-950">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-white/60" />
        <p className="mt-3 text-sm text-white/60">Loading workshop room...</p>
      </div>
    </div>
  );
}
