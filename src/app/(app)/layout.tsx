'use client';

import { type ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AppShell } from '@/components/layout/AppShell';

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

  // Daily post routes are accessible to guests
  const isGuestAllowedRoute = pathname === '/' || pathname.startsWith('/daily/');

  useEffect(() => {
    if (!loading && !isAuthenticated && !isGuestAllowedRoute) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router, isGuestAllowedRoute]);

  useEffect(() => {
    if (!loading && isAuthenticated && user && !user.onboarding_complete) {
      router.replace('/onboarding/mode');
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
        <AppShell>{children}</AppShell>
      </NotificationProvider>
    </SocketProvider>
  );
}

function GuestDailyWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Daily post content (full screen) */}
      <main className="flex-1">{children}</main>

      {/* Sign up / Sign in CTA overlay at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 via-black/70 to-transparent pb-6 pt-16 px-6">
        <div className="mx-auto max-w-sm text-center">
          <p className="mb-4 text-sm text-white/80">
            Join Free Luma for the full experience
          </p>
          <div className="flex gap-3">
            <Link
              href="/signup"
              className="flex-1 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-primary-dark"
            >
              Sign Up
            </Link>
            <Link
              href="/login"
              className="flex-1 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </AuthProvider>
  );
}
