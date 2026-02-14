'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

interface AppleButtonProps {
  mode: 'login' | 'signup';
  activationCode?: string;
  onNeedsActivationCode?: () => void;
}

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: {
            id_token: string;
            code: string;
          };
          user?: {
            name?: {
              firstName?: string;
              lastName?: string;
            };
            email?: string;
          };
        }>;
      };
    };
  }
}

export function AppleButton({
  mode,
  activationCode,
  onNeedsActivationCode,
}: AppleButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
  const isConfigured = Boolean(clientId);
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // Load Apple JS SDK
  useEffect(() => {
    if (!isConfigured) return;

    // Check if already loaded
    if (window.AppleID) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => {
      setSdkLoaded(true);
    };
    script.onerror = () => {
      console.error('[Apple Auth] Failed to load Apple JS SDK');
    };
    document.head.appendChild(script);

    return () => {
      // Don't remove the script on cleanup -- it may be needed by other instances
    };
  }, [isConfigured]);

  // Initialize Apple ID auth when SDK loads
  useEffect(() => {
    if (!sdkLoaded || !clientId || !window.AppleID) return;

    try {
      window.AppleID.auth.init({
        clientId,
        scope: 'name email',
        redirectURI: `${window.location.origin}/api/auth/apple/callback`,
        usePopup: true,
      });
    } catch (err) {
      console.error('[Apple Auth] Initialization failed:', err);
    }
  }, [sdkLoaded, clientId]);

  const handleAppleSignIn = useCallback(async () => {
    if (!window.AppleID) {
      toast.error('Apple Sign-In is not available');
      return;
    }

    setIsLoading(true);

    try {
      const response = await window.AppleID.auth.signIn();

      const res = await fetch('/api/auth/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          identityToken: response.authorization.id_token,
          user: response.user || null,
          activation_code: activationCode,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (
          res.status === 400 &&
          result.error?.includes('Activation code required')
        ) {
          if (onNeedsActivationCode) {
            onNeedsActivationCode();
          } else {
            toast.info('You need an activation code to create a new account.');
            router.push('/signup');
          }
          return;
        }
        toast.error(result.error || 'Apple Sign-In failed');
        return;
      }

      login(result.user, result.token);

      if (result.isNewUser) {
        toast.success('Account created with Apple!');
        router.push('/onboarding/mode');
      } else {
        toast.success('Welcome back!');
        router.push('/');
      }
    } catch (err) {
      // Apple popup was closed by user (not an error)
      if (err instanceof Error && err.message?.includes('popup_closed')) {
        return;
      }
      console.error('[Apple Auth] Sign-in error:', err);
      toast.error('Apple Sign-In failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activationCode, login, onNeedsActivationCode, router, toast]);

  return (
    <Button
      variant="outline"
      fullWidth
      disabled={!isConfigured || isLoading}
      loading={isLoading}
      title={!isConfigured ? 'Apple Sign-In not configured' : undefined}
      onClick={handleAppleSignIn}
      className="bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-100 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.12 4.53-3.74 4.25z" />
      </svg>
      <span>
        {mode === 'login' ? 'Sign in with Apple' : 'Sign up with Apple'}
      </span>
    </Button>
  );
}
