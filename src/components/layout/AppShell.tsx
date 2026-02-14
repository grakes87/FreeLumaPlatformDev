'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
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

  // Single DOM tree with conditional styles — avoids child remount when toggling immersive.
  // Two separate returns would cause React to unmount/remount children on every toggle.
  return (
    <div
      className={cn(
        isTransparent
          ? 'fixed inset-0 overflow-hidden bg-black'
          : 'flex min-h-screen flex-col bg-background dark:bg-background-dark'
      )}
    >
      <TopBar transparent={isTransparent} />
      {!isTransparent && (
        <div className="shrink-0" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
          <VerifyEmailBanner />
        </div>
      )}
      <main
        id={isTransparent ? 'immersive-scroll' : undefined}
        className={cn(
          isTransparent ? 'h-full overflow-y-auto' : 'flex-1 overflow-y-auto'
        )}
        style={
          isTransparent
            ? { scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain' }
            : { paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }
        }
      >
        {children}
      </main>
      <BottomNav transparent={isTransparent} />
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
