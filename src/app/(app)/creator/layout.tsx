'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clapperboard } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

/**
 * Creator portal layout.
 * Inherits auth from the (app) layout / AppShell.
 * Verifies the user has an active creator profile via /api/creator/stats.
 * Redirects non-creators to /feed with a toast query param.
 */
export default function CreatorLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkCreator() {
      try {
        const res = await fetch('/api/creator/stats');
        if (!cancelled) {
          if (res.status === 403) {
            router.replace('/feed?toast=not-a-creator');
            return;
          }
          if (res.ok) {
            setVerified(true);
          } else {
            // Unexpected error -- redirect to feed
            router.replace('/feed');
          }
        }
      } catch {
        if (!cancelled) {
          router.replace('/feed');
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    checkCreator();
    return () => { cancelled = true; };
  }, [router]);

  if (checking || !verified) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Creator sub-header */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-sm dark:border-border-dark dark:bg-surface-dark/95">
        <div className="mx-auto flex h-12 max-w-2xl items-center gap-3 px-4">
          <Link
            href="/feed"
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Clapperboard className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold text-text dark:text-text-dark">
            Creator Portal
          </h1>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        {children}
      </main>
    </div>
  );
}
