'use client';

import { useState, useCallback } from 'react';
import { Link2, Unlink } from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// ---- Provider Icon ----

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ---- Types ----

interface ConnectedAccountsSectionProps {
  hasGoogleId: boolean;
  googleEmail?: string | null;
  hasAppleId: boolean;
  onProviderChange?: () => void;
}

// ---- Inner Component (needs GoogleOAuthProvider context) ----

function ConnectedAccountsInner({
  hasGoogleId,
  googleEmail: initialGoogleEmail,
  onProviderChange,
}: {
  hasGoogleId: boolean;
  googleEmail?: string | null;
  onProviderChange?: () => void;
}) {
  const toast = useToast();
  const [googleConnected, setGoogleConnected] = useState(hasGoogleId);
  const [googleEmail, setGoogleEmail] = useState<string | null>(initialGoogleEmail ?? null);
  const [loading, setLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/link-provider', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            provider: 'google',
            token: tokenResponse.access_token,
            token_type: 'access_token',
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          toast.error(result.error || 'Failed to link Google account');
          return;
        }

        setGoogleConnected(true);
        setGoogleEmail(result.email || null);
        toast.success('Google account linked!');
        onProviderChange?.();
      } catch {
        toast.error('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('[Google Link] Error:', error);
      toast.error('Google Sign-In failed. Please try again.');
    },
  });

  const handleUnlink = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/unlink-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: 'google' }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (res.status === 400 && result.error?.includes('password')) {
          toast.warning('You need to set a password before unlinking Google.');
        } else {
          toast.error(result.error || 'Failed to unlink Google.');
        }
        return;
      }

      setGoogleConnected(false);
      setGoogleEmail(null);
      toast.success('Google account unlinked.');
      onProviderChange?.();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [toast, onProviderChange]);

  return (
    <Card padding="sm" className="!p-0 overflow-hidden">
      <div className="px-4 py-3.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
          Connected Accounts
        </h4>
      </div>

      <div className="flex items-center gap-3 px-4 py-3.5">
        <GoogleIcon className="h-5 w-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text dark:text-text-dark">
            Google
          </p>
          {googleConnected && googleEmail && (
            <p className="text-xs text-text dark:text-text-dark truncate">
              {googleEmail}
            </p>
          )}
          <p className="text-xs text-text-muted dark:text-text-muted-dark">
            {googleConnected ? 'Connected' : 'Not connected'}
          </p>
        </div>
        {googleConnected ? (
          <Button
            variant="outline"
            size="sm"
            loading={loading}
            onClick={handleUnlink}
            className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
          >
            <Unlink className="h-3.5 w-3.5" />
            Unlink
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            loading={loading}
            onClick={() => googleLogin()}
          >
            <Link2 className="h-3.5 w-3.5" />
            Link
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---- Exported Component ----

export function ConnectedAccountsSection({
  hasGoogleId,
  googleEmail,
  onProviderChange,
}: ConnectedAccountsSectionProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return null;
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ConnectedAccountsInner
        hasGoogleId={hasGoogleId}
        googleEmail={googleEmail}
        onProviderChange={onProviderChange}
      />
    </GoogleOAuthProvider>
  );
}
