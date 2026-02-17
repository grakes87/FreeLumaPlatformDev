'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ActivationCodeFormData {
  code: string;
}

interface ActivationCodeStepProps {
  onValidated: (code: string, modeHint: string | null) => void;
}

export function ActivationCodeStep({ onValidated }: ActivationCodeStepProps) {
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoValidating, setAutoValidating] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ActivationCodeFormData>({
    defaultValues: { code: '' },
  });

  // Auto-validate from URL query param — skip step if code is valid
  useEffect(() => {
    const codeFromUrl = searchParams.get('activation_code');
    if (!codeFromUrl) return;

    setValue('code', codeFromUrl);
    let cancelled = false;

    (async () => {
      setAutoValidating(true);
      try {
        const res = await fetch('/api/activation-codes/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeFromUrl.trim() }),
        });
        const result = await res.json();
        if (!cancelled && res.ok) {
          // Code is valid and pending — skip activation step
          onValidated(codeFromUrl.trim(), result.mode_hint || null);
          return;
        }
        if (!cancelled) {
          setServerError('This activation code is invalid or has already been used.');
        }
      } catch {
        // Validation failed — show the form for manual entry
      } finally {
        if (!cancelled) setAutoValidating(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (data: ActivationCodeFormData) => {
    setServerError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/activation-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: data.code.trim() }),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.error || 'Invalid or expired activation code');
        return;
      }

      onValidated(data.code.trim(), result.mode_hint || null);
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (autoValidating) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            Validating activation code...
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text dark:text-text-dark">
            Enter your activation code
          </h2>
          <p className="mt-2 text-sm text-text-muted dark:text-text-muted-dark">
            You need an activation code to create an account.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            {...register('code', {
              required: 'Activation code is required',
              minLength: { value: 12, message: 'Activation code must be at least 12 characters' },
              maxLength: { value: 14, message: 'Activation code must be at most 14 characters' },
            })}
            label="Activation Code"
            placeholder="Enter activation code"
            error={errors.code?.message}
            autoFocus
            autoComplete="off"
          />

          {serverError && (
            <p className="text-sm text-red-500">{serverError}</p>
          )}

          <Button type="submit" fullWidth loading={isSubmitting}>
            Continue
          </Button>
        </form>
      </div>
    </Card>
  );
}
