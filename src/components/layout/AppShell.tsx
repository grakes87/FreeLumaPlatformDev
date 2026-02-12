'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Daily post pages use transparent overlays (video shows through)
  const isDailyPost = pathname === '/' || pathname.startsWith('/daily/');

  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-background-dark">
      <TopBar transparent={isDailyPost} />
      <main className={isDailyPost ? 'flex-1' : 'flex-1 overflow-y-auto pt-14 pb-16'}>
        {children}
      </main>
      <BottomNav transparent={isDailyPost} />
    </div>
  );
}
