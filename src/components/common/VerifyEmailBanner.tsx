'use client';

import { useState, useEffect } from 'react';
import { X, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';

const DISMISS_KEY = 'verify-email-banner-dismissed';

export function VerifyEmailBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Check sessionStorage for dismissal
    const wasDismissed = sessionStorage.getItem(DISMISS_KEY) === 'true';
    setDismissed(wasDismissed);
  }, []);

  // Don't render if user is verified, not loaded, or banner dismissed
  if (!user || user.email_verified !== false || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  const handleSendVerification = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Verification email sent! Check your inbox.');
      } else {
        toast.error(data.error || 'Failed to send verification email.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 px-4 py-2.5',
        'bg-amber-50 border-b border-amber-200',
        'dark:bg-amber-900/20 dark:border-amber-800/40'
      )}
    >
      <Mail className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />

      <p className="flex-1 text-xs text-amber-800 dark:text-amber-200">
        Verify your email address to secure your account.
      </p>

      <button
        type="button"
        onClick={handleSendVerification}
        disabled={sending}
        className={cn(
          'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          'bg-amber-600 text-white hover:bg-amber-700',
          'dark:bg-amber-500 dark:hover:bg-amber-600',
          sending && 'opacity-60 pointer-events-none'
        )}
      >
        {sending ? 'Sending...' : 'Verify'}
      </button>

      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 p-0.5 text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
