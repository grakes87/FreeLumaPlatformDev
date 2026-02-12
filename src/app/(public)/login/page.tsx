'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { SocialDivider } from '@/components/auth/SocialDivider';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AppleButton } from '@/components/auth/AppleButton';

function LoginContent() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">Free Luma</h1>
        <p className="mt-2 text-sm text-text-muted dark:text-text-muted-dark">
          Daily inspiration and faith-based community
        </p>
      </div>

      <LoginForm />

      <SocialDivider />

      <div className="space-y-3">
        <GoogleButton mode="login" />
        <AppleButton mode="login" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <Suspense>
        <LoginContent />
      </Suspense>
    </AuthProvider>
  );
}
