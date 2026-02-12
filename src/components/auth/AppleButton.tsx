'use client';

import { Button } from '@/components/ui/Button';

interface AppleButtonProps {
  mode: 'login' | 'signup';
  activationCode?: string;
  onSuccess?: () => void;
}

export function AppleButton({ mode }: AppleButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
  const isConfigured = Boolean(clientId);

  return (
    <Button
      variant="outline"
      fullWidth
      disabled={!isConfigured}
      title={!isConfigured ? 'Apple Sign-In not configured' : undefined}
      onClick={() => {
        // Will be implemented in Task 2 with Apple JS SDK
      }}
      className="bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-100 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.12 4.53-3.74 4.25z" />
      </svg>
      <span>
        {mode === 'login' ? 'Sign in with Apple' : 'Sign up with Apple'}
      </span>
    </Button>
  );
}
