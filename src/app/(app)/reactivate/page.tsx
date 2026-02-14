'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';

export default function ReactivatePage() {
  const { logout, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReactivate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/account/reactivate', {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        await refreshUser();
        router.replace('/');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to reactivate account');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface dark:bg-surface-dark p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        {/* Icon */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <UserCheck className="h-10 w-10 text-amber-500" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Account Deactivated
        </h1>

        {/* Description */}
        <p className="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-muted-dark">
          Your account is currently deactivated. Your profile and content are hidden from other users.
          Reactivate your account to continue using Free Luma.
        </p>

        {/* Error */}
        {error && (
          <div className="mt-4 w-full rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Reactivate button */}
        <button
          type="button"
          onClick={handleReactivate}
          disabled={loading}
          className={cn(
            'mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
            'bg-primary text-white hover:bg-primary-dark disabled:opacity-50'
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          {loading ? 'Reactivating...' : 'Reactivate My Account'}
        </button>

        {/* Logout button */}
        <button
          type="button"
          onClick={() => logout()}
          className={cn(
            'mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
            'text-text-muted hover:bg-slate-100',
            'dark:text-text-muted-dark dark:hover:bg-white/5'
          )}
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </div>
  );
}
