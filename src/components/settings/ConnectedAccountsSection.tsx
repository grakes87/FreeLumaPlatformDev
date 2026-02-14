'use client';

import { useState, useCallback } from 'react';
import { Link2, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// ---- Provider Icons ----

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

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('fill-current', className)} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.12 4.53-3.74 4.25z" />
    </svg>
  );
}

// ---- Types ----

interface ProviderInfo {
  provider: 'google' | 'apple';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
}

interface ConnectedAccountsSectionProps {
  hasGoogleId: boolean;
  hasAppleId: boolean;
  onProviderChange?: () => void;
}

// ---- Component ----

export function ConnectedAccountsSection({
  hasGoogleId,
  hasAppleId,
  onProviderChange,
}: ConnectedAccountsSectionProps) {
  const toast = useToast();
  const [googleConnected, setGoogleConnected] = useState(hasGoogleId);
  const [appleConnected, setAppleConnected] = useState(hasAppleId);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const providers: ProviderInfo[] = [
    {
      provider: 'google',
      label: 'Google',
      icon: GoogleIcon,
      connected: googleConnected,
    },
    {
      provider: 'apple',
      label: 'Apple',
      icon: AppleIcon,
      connected: appleConnected,
    },
  ];

  const handleUnlink = useCallback(
    async (provider: 'google' | 'apple') => {
      setLoadingProvider(provider);
      try {
        const res = await fetch('/api/auth/unlink-provider', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ provider }),
        });

        const result = await res.json();

        if (!res.ok) {
          if (res.status === 400 && result.error?.includes('password')) {
            toast.warning('You need to set a password before unlinking this provider.');
          } else {
            toast.error(result.error || `Failed to unlink ${provider}.`);
          }
          return;
        }

        if (provider === 'google') setGoogleConnected(false);
        else setAppleConnected(false);
        toast.success(`${provider === 'google' ? 'Google' : 'Apple'} account unlinked.`);
        onProviderChange?.();
      } catch {
        toast.error('Something went wrong. Please try again.');
      } finally {
        setLoadingProvider(null);
      }
    },
    [toast, onProviderChange]
  );

  const handleLink = useCallback(
    async (provider: 'google' | 'apple') => {
      // For linking, we need to trigger the OAuth flow and get a token.
      // Google uses @react-oauth/google, Apple uses their JS SDK.
      // Since these are complex flows, we provide a simpler indication.
      toast.info(
        `To link ${provider === 'google' ? 'Google' : 'Apple'}, use the "${provider === 'google' ? 'Sign in with Google' : 'Sign in with Apple'}" button on the login page while signed into this account.`
      );
    },
    [toast]
  );

  return (
    <Card padding="sm" className="!p-0 overflow-hidden">
      <div className="px-4 py-3.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
          Connected Accounts
        </h4>
      </div>

      {providers.map((p, index) => {
        const ProviderIcon = p.icon;
        const isLoading = loadingProvider === p.provider;

        return (
          <div key={p.provider}>
            {index > 0 && (
              <div className="mx-4 border-t border-border dark:border-border-dark" />
            )}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <ProviderIcon className="h-5 w-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text dark:text-text-dark">
                  {p.label}
                </p>
                <p className="text-xs text-text-muted dark:text-text-muted-dark">
                  {p.connected ? 'Connected' : 'Not connected'}
                </p>
              </div>
              {p.connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  loading={isLoading}
                  onClick={() => handleUnlink(p.provider)}
                  className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Unlink
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLink(p.provider)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Link
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
