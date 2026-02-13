'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { VerifyEmailBanner } from '@/components/common/VerifyEmailBanner';
import { ImmersiveProvider, useImmersive } from '@/context/ImmersiveContext';
import { NotificationToastManager } from '@/components/notifications/NotificationToast';

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { immersive } = useImmersive();

  // Daily post pages use transparent overlays (video shows through)
  const isDailyPost = pathname === '/' || pathname.startsWith('/daily/');
  const isTransparent = isDailyPost || immersive;

  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-background-dark">
      <TopBar transparent={isTransparent} />
      {isTransparent ? (
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
      <BottomNav transparent={isTransparent} />
      <NotificationToastManager />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ImmersiveProvider>
      <AppShellInner>{children}</AppShellInner>
    </ImmersiveProvider>
  );
}
