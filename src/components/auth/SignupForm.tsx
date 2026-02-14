'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import {
  signupCredentialsSchema,
  type SignupCredentialsInput,
} from '@/lib/utils/validation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ActivationCodeStep } from './ActivationCodeStep';

type Step = 'activation' | 'credentials';

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<Step>('activation');
  const [activationCode, setActivationCode] = useState('');
  const [modeHint, setModeHint] = useState<string | null>(null);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<SignupCredentialsInput>({
    resolver: zodResolver(signupCredentialsSchema),
    defaultValues: {
      email: '',
      password: '',
      display_name: '',
      username: '',
      date_of_birth: '',
      terms_accepted: false,
    },
  });

  const password = watch('password', '');

  const passwordRequirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
  ];

  const handleActivationValidated = (code: string, hint: string | null) => {
    setActivationCode(code);
    setModeHint(hint || searchParams.get('mode'));
    setStep('credentials');
  };

  const onSubmit = async (data: SignupCredentialsInput) => {
    setServerError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          display_name: data.display_name,
          username: data.username,
          activation_code: activationCode,
          date_of_birth: data.date_of_birth,
          terms_accepted: data.terms_accepted,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.error || 'Registration failed');
        return;
      }

      login(result.user, result.token);
      toast.success('Account created successfully!');

      // Redirect to onboarding with mode hint if available
      const redirectMode = modeHint || searchParams.get('mode');
      const onboardingUrl = redirectMode
        ? `/onboarding/mode?mode=${redirectMode}`
        : '/onboarding/mode';
      router.push(onboardingUrl);
    } catch {
      setServerError('Something went wrong. Please try again.');
    }
  };

  if (step === 'activation') {
    return (
      <div className="space-y-4">
        <ActivationCodeStep onValidated={handleActivationValidated} />
        <p className="text-center text-sm text-text-muted dark:text-text-muted-dark">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary-dark transition-colors"
          >
            Log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-center text-xl font-semibold text-text dark:text-text-dark">
          Create your account
        </h2>

        <Input
          {...register('email')}
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          autoComplete="email"
          autoFocus
        />

        <Input
          {...register('display_name')}
          label="Display Name"
          placeholder="Your name"
          error={errors.display_name?.message}
          autoComplete="name"
        />

        <div>
          <label
            htmlFor="username"
            className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark"
          >
            Username
          </label>
          <div className="flex items-center rounded-xl border border-border bg-surface transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/50 dark:border-border-dark dark:bg-surface-dark">
            <span className="pl-4 text-text-muted dark:text-text-muted-dark">
              @
            </span>
            <input
              {...register('username')}
              id="username"
              placeholder="username"
              autoComplete="username"
              className="w-full rounded-xl bg-transparent px-2 py-3 text-text outline-none placeholder:text-text-muted dark:text-text-dark dark:placeholder:text-text-muted-dark"
            />
          </div>
          {errors.username?.message && (
            <p className="mt-1.5 text-sm text-red-500">
              {errors.username.message}
            </p>
          )}
        </div>

        <div>
          <Input
            {...register('password')}
            label="Password"
            type="password"
            placeholder="Create a password"
            error={errors.password?.message}
            autoComplete="new-password"
          />
          <div className="mt-2 space-y-1">
            {passwordRequirements.map((req) => (
              <div key={req.label} className="flex items-center gap-2 text-xs">
                <span
                  className={
                    req.met
                      ? 'text-green-500'
                      : 'text-text-muted dark:text-text-muted-dark'
                  }
                >
                  {req.met ? '\u2713' : '\u2022'}
                </span>
                <span
                  className={
                    req.met
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-text-muted dark:text-text-muted-dark'
                  }
                >
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Input
          {...register('date_of_birth')}
          label="Date of Birth"
          type="date"
          error={errors.date_of_birth?.message}
        />

        <div className="flex items-start gap-3">
          <input
            {...register('terms_accepted')}
            type="checkbox"
            id="terms"
            className="mt-1 h-4 w-4 rounded border-border accent-primary"
          />
          <label
            htmlFor="terms"
            className="text-sm text-text-muted dark:text-text-muted-dark"
          >
            I agree to the{' '}
            <Link href="/terms" className="text-primary hover:text-primary-dark">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary hover:text-primary-dark">
              Privacy Policy
            </Link>
          </label>
        </div>
        {errors.terms_accepted?.message && (
          <p className="text-sm text-red-500">{errors.terms_accepted.message}</p>
        )}

        {serverError && (
          <p className="text-sm text-red-500">{serverError}</p>
        )}

        <Button type="submit" fullWidth loading={isSubmitting}>
          Create Account
        </Button>

        <div className="flex flex-col items-center gap-2 pt-2 text-sm">
          <p className="text-text-muted dark:text-text-muted-dark">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary-dark transition-colors"
            >
              Log in
            </Link>
          </p>
        </div>
      </form>
    </Card>
  );
}
