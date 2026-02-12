'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { VerifyEmailBanner } from '@/components/common/VerifyEmailBanner';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Daily post pages use transparent overlays (video shows through)
  const isDailyPost = pathname === '/' || pathname.startsWith('/daily/');

  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-background-dark">
      <TopBar transparent={isDailyPost} />
      {isDailyPost ? (
        <main className="flex-1">
          {children}
        </main>
      ) : (
        <>
          <div className="shrink-0 pt-14">
            <VerifyEmailBanner />
          </div>
          <main className="flex-1 overflow-y-auto pb-16">
            {children}
          </main>
        </>
      )}
      <BottomNav transparent={isDailyPost} />
    </div>
  );
}
