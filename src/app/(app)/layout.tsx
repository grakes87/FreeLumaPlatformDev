'use client';

import { type ReactNode, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { DailyTranslationProvider } from '@/context/DailyTranslationContext';
import { useAuth } from '@/hooks/useAuth';
import { useStaleSession } from '@/hooks/useStaleSession';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AppShell } from '@/components/layout/AppShell';
import { TopBar } from '@/components/layout/TopBar';
import { FontLoader } from '@/components/layout/FontLoader';

// Suppress React 19 pointer capture error on unmounting elements during navigation
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e.message?.includes('releasePointerCapture')) {
      e.preventDefault();
    }
  });
}

function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Auto-refresh after 30 min backgrounded to prevent memory bloat
  useStaleSession();

  // Daily post routes and mode landing pages are accessible to guests
  const isGuestAllowedRoute =
    pathname === '/' || pathname.startsWith('/daily/') || pathname === '/bible' || pathname === '/positivity';

  useEffect(() => {
    if (!loading && !isAuthenticated && !isGuestAllowedRoute) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router, isGuestAllowedRoute]);

  useEffect(() => {
    if (!loading && isAuthenticated && user && !user.onboarding_complete) {
      router.replace('/onboarding/profile');
    }
  }, [loading, isAuthenticated, user, router]);

  // Deactivated users must explicitly reactivate before using the app
  useEffect(() => {
    if (!loading && isAuthenticated && user && user.status === 'deactivated' && pathname !== '/reactivate') {
      router.replace('/reactivate');
    }
  }, [loading, isAuthenticated, user, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Guest on daily post — show content without nav, with sign-up CTA
  if (!isAuthenticated && isGuestAllowedRoute) {
    return <GuestDailyWrapper>{children}</GuestDailyWrapper>;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (user && !user.onboarding_complete) {
    return null;
  }

  // Deactivated users see reactivation page without app shell
  if (user && user.status === 'deactivated') {
    return <>{children}</>;
  }

  return (
    <SocketProvider>
      <NotificationProvider>
        <FontLoader />
        <AppShell>{children}</AppShell>
      </NotificationProvider>
    </SocketProvider>
  );
}

function GuestDailyWrapper({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const code = searchParams.get('code');

  // Determine mode from the route
  const mode = pathname === '/positivity' ? 'positivity' : 'bible';

  // Build signup/login URLs preserving activation code and mode
  let signupHref = `/signup?mode=${mode}`;
  let loginHref = '/login';
  if (code) {
    signupHref = `/signup?activation_code=${encodeURIComponent(code)}&mode=${mode}`;
  }

  return (
    <DailyTranslationProvider>
      <div className="fixed inset-0 overflow-hidden bg-black">
        <TopBar transparent />

        {/* Daily post content (full screen, scroll snap matches authenticated AppShell) */}
        <main
          id="immersive-scroll"
          className="h-full overflow-y-auto"
          style={{ scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain' }}
        >
          {children}
        </main>

        {/* Sign up / Sign in CTA overlay at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 via-black/70 to-transparent pb-6 pt-16 px-6">
          <div className="mx-auto max-w-sm text-center">
            <p className="mb-4 text-sm text-white/80">
              Join Free Luma for the full experience
            </p>
            <div className="flex gap-3">
              <Link
                href={signupHref}
                className="flex-1 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-primary-dark"
              >
                Sign Up
              </Link>
              <Link
                href={loginHref}
                className="flex-1 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DailyTranslationProvider>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </AuthProvider>
  );
}
