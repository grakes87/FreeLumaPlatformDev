'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AdminNav } from '@/components/admin/AdminNav';

function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!loading && isAuthenticated && user && !user.is_admin) {
      router.replace('/feed');
    }
  }, [loading, isAuthenticated, user, router]);

  // Fetch pending report count for nav badge
  useEffect(() => {
    if (user?.is_admin) {
      fetch('/api/admin/flagged', { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          setPendingCount(
            (data.pending_reports || 0) +
              (data.flagged_posts || 0) +
              (data.flagged_comments || 0)
          );
        })
        .catch(() => {});
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.is_admin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background dark:bg-background-dark">
      <AdminNav pendingCount={pendingCount} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminGuard>{children}</AdminGuard>
    </AuthProvider>
  );
}
