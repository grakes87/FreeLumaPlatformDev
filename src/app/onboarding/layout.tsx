'use client';

import { type ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils/cn';

const ONBOARDING_STEPS = [
  { path: '/onboarding/mode', label: 'Mode' },
  { path: '/onboarding/profile', label: 'Profile' },
  { path: '/onboarding/interests', label: 'Interests' },
  { path: '/onboarding/follow', label: 'Follow' },
];

function OnboardingContent({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!loading && isAuthenticated && user && user.onboarding_complete) {
      router.replace('/');
    }
  }, [loading, isAuthenticated, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (user && user.onboarding_complete) {
    return null;
  }

  const currentStepIndex = ONBOARDING_STEPS.findIndex(
    (step) => step.path === pathname
  );
  const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : 1;
  const totalSteps = ONBOARDING_STEPS.length;

  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-background-dark">
      {/* Logo */}
      <div className="flex items-center justify-center pt-8 pb-4">
        <span className="text-2xl font-bold text-primary">Free Luma</span>
      </div>

      {/* Step indicator */}
      <div className="flex flex-col items-center gap-3 px-4 pb-6">
        <p className="text-sm font-medium text-text-muted dark:text-text-muted-dark">
          Step {currentStep} of {totalSteps}
        </p>
        <div className="flex w-full max-w-xs gap-2">
          {ONBOARDING_STEPS.map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                index < currentStep
                  ? 'bg-primary'
                  : 'bg-border dark:bg-border-dark'
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-start justify-center px-4 pb-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <OnboardingContent>{children}</OnboardingContent>
    </AuthProvider>
  );
}
