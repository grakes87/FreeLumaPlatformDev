'use client';

import { useSearchParams } from 'next/navigation';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils/cn';

/**
 * Ban screen shown when a user's account is suspended.
 * Displays reason, expiry date, contact support link, and logout button.
 * No navigation (no bottom nav, no top bar).
 */
export default function BannedPage() {
  const { logout } = useAuth();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'Your account has been suspended for violating our community guidelines.';
  const expiresAt = searchParams.get('expires');

  const expiryDate = expiresAt ? new Date(expiresAt) : null;
  const isPermanent = !expiryDate;
  const isExpired = expiryDate && expiryDate <= new Date();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface dark:bg-surface-dark p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        {/* Shield icon */}
        <div className={cn(
          'mb-6 flex h-20 w-20 items-center justify-center rounded-full',
          'bg-red-100 dark:bg-red-900/30'
        )}>
          <ShieldAlert className="h-10 w-10 text-red-500" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Account Suspended
        </h1>

        {/* Reason */}
        <p className="mt-3 text-sm leading-relaxed text-text-muted dark:text-text-muted-dark">
          {reason}
        </p>

        {/* Expiry info */}
        <div className={cn(
          'mt-4 rounded-xl px-4 py-3 text-sm',
          isPermanent
            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
            : isExpired
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
        )}>
          {isPermanent ? (
            <p>This suspension is permanent. Contact support for more information.</p>
          ) : isExpired ? (
            <p>Your suspension has expired. Please log out and log back in to access your account.</p>
          ) : (
            <p>
              Your suspension will be lifted on{' '}
              <span className="font-semibold">
                {expiryDate.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </p>
          )}
        </div>

        {/* Contact Support */}
        <a
          href="mailto:support@freeluma.com?subject=Account%20Suspension%20Appeal"
          className={cn(
            'mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors',
            'text-primary hover:bg-primary/5',
            'dark:border-border-dark dark:text-primary dark:hover:bg-primary/10'
          )}
        >
          <Mail className="h-4 w-4" />
          Contact Support
        </a>

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
