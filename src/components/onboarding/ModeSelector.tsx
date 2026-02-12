'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Sun, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

type Mode = 'bible' | 'positivity';

interface ModeOption {
  value: Mode;
  title: string;
  description: string;
  icon: typeof BookOpen;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'bible',
    title: 'Bible / Faith',
    description: 'Daily Bible verses, prayer, and faith community',
    icon: BookOpen,
  },
  {
    value: 'positivity',
    title: 'Positivity',
    description: 'Daily inspirational quotes and positive community',
    icon: Sun,
  },
];

export function ModeSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Pre-select from URL hint (e.g., ?mode=bible from signup flow)
  const modeHint = searchParams.get('mode') as Mode | null;
  const [selected, setSelected] = useState<Mode | null>(
    modeHint && (modeHint === 'bible' || modeHint === 'positivity')
      ? modeHint
      : null
  );
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;

    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: selected }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save mode');
      }

      router.push('/onboarding/profile');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          Choose Your Experience
        </h1>
        <p className="mt-2 text-text-muted dark:text-text-muted-dark">
          Select the experience that best fits your journey. You can change this
          anytime in settings.
        </p>
      </div>

      <div className="flex w-full flex-col gap-4">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selected === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelected(option.value)}
              className={cn(
                'relative flex items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all',
                'bg-surface dark:bg-surface-dark',
                isSelected
                  ? 'border-primary shadow-md ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40 dark:border-border-dark dark:hover:border-primary/40'
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
                  isSelected
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                )}
              >
                <Icon className="h-6 w-6" />
              </div>

              {/* Text */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text dark:text-text-dark">
                  {option.title}
                </h3>
                <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
                  {option.description}
                </p>
              </div>

              {/* Checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleContinue}
        disabled={!selected}
        loading={saving}
        fullWidth
        size="lg"
      >
        Continue
      </Button>
    </div>
  );
}
