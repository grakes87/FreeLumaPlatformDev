'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { VerifyEmailBanner } from '@/components/common/VerifyEmailBanner';
import { ImmersiveProvider, useImmersive } from '@/context/ImmersiveContext';
import { DailyTranslationProvider } from '@/context/DailyTranslationContext';
import { NotificationToastManager } from '@/components/notifications/NotificationToast';

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { immersive } = useImmersive();

  // Daily post pages use transparent overlays (video shows through)
  const isDailyPost = pathname === '/' || pathname.startsWith('/daily/');
  const isTransparent = isDailyPost || immersive;

  // Transparent mode: fixed viewport container prevents document scroll,
  // locking Safari toolbar in place. Content scrolls within <main>.
  if (isTransparent) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-black">
        <TopBar transparent />
        <main
          id="immersive-scroll"
          className="h-full overflow-y-auto"
          style={{ scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain' }}
        >
          {children}
        </main>
        <BottomNav transparent />
        <NotificationToastManager />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-background-dark">
      <TopBar transparent={false} />
      <div className="shrink-0" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
        <VerifyEmailBanner />
      </div>
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </main>
      <BottomNav transparent={false} />
      <NotificationToastManager />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ImmersiveProvider>
      <DailyTranslationProvider>
        <AppShellInner>{children}</AppShellInner>
      </DailyTranslationProvider>
    </ImmersiveProvider>
  );
}
