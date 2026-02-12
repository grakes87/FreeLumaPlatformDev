'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { SignupForm } from '@/components/auth/SignupForm';
import { SocialDivider } from '@/components/auth/SocialDivider';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AppleButton } from '@/components/auth/AppleButton';

function SignupContent() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">Free Luma</h1>
        <p className="mt-2 text-sm text-text-muted dark:text-text-muted-dark">
          Create your account
        </p>
      </div>

      <SignupForm />

      <SocialDivider />

      <div className="space-y-3">
        <GoogleButton mode="signup" />
        <AppleButton mode="signup" />
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <AuthProvider>
      <Suspense>
        <SignupContent />
      </Suspense>
    </AuthProvider>
  );
}
