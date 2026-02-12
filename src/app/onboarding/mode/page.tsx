import { Suspense } from 'react';
import { ModeSelector } from '@/components/onboarding/ModeSelector';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function OnboardingModePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <ModeSelector />
    </Suspense>
  );
}
