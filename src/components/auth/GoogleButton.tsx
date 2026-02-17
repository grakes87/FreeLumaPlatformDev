'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

interface GoogleButtonProps {
  mode: 'login' | 'signup';
  activationCode?: string;
  onNeedsActivationCode?: () => void;
}

function GoogleButtonInner({
  mode,
  activationCode,
  onNeedsActivationCode,
}: GoogleButtonProps) {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      toast.error('Google Sign-In failed: no credential received');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credential: credentialResponse.credential,
          activation_code: activationCode,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (
          res.status === 400 &&
          result.error?.includes('Activation code required')
        ) {
          // New user needs activation code first
          if (onNeedsActivationCode) {
            onNeedsActivationCode();
          } else {
            toast.info('You need an activation code to create a new account.');
            router.push('/signup');
          }
          return;
        }
        toast.error(result.error || 'Google Sign-In failed');
        return;
      }

      login(result.user, result.token);

      if (result.isNewUser) {
        toast.success('Account created with Google!');
        router.push('/onboarding/profile');
      } else {
        toast.success('Welcome back!');
        router.push('/');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" fullWidth loading disabled>
        Signing in with Google...
      </Button>
    );
  }

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => {
          toast.error('Google Sign-In failed. Please try again.');
        }}
        text={mode === 'login' ? 'signin_with' : 'signup_with'}
        shape="pill"
        width="360"
        theme="outline"
      />
    </div>
  );
}

export function GoogleButton(props: GoogleButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <Button
        variant="outline"
        fullWidth
        disabled
        title="Google Sign-In not configured"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
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
        <span>
          {props.mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
        </span>
      </Button>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleButtonInner {...props} />
    </GoogleOAuthProvider>
  );
}
