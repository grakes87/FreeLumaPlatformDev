'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Phone, CheckCircle, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';

interface PhoneNumberSectionProps {
  currentPhone: string | null;
  phoneVerified: boolean;
  onPhoneVerified: () => void;
}

export function PhoneNumberSection({
  currentPhone,
  phoneVerified,
  onPhoneVerified,
}: PhoneNumberSectionProps) {
  const toast = useToast();
  const [phone, setPhone] = useState<string>(currentPhone || '');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync currentPhone from parent when it changes
  useEffect(() => {
    if (currentPhone) {
      setPhone(currentPhone);
    }
  }, [currentPhone]);

  // Cleanup cooldown interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
      }
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(60);
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
    }
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
            cooldownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendOTP = async () => {
    if (!phone) {
      setError('Please enter a phone number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (res.ok) {
        setOtpSent(true);
        startCooldown();
      } else {
        setError(data.error || 'Failed to send verification code');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/sms/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, code: otp }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Phone number verified!');
        onPhoneVerified();
      } else {
        setError(data.error || 'Invalid verification code');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeNumber = () => {
    setOtpSent(false);
    setOtp('');
    setPhone('');
    setCooldown(0);
    setError(null);
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
  };

  // State 3: Phone verified
  if (phoneVerified && currentPhone) {
    return (
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2 mb-3">
          <Phone className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
          <p className="text-sm font-medium text-text dark:text-text-dark">
            Phone Number
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-text dark:text-text-dark">
              {currentPhone}
            </span>
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              Verified
            </span>
          </div>
          <button
            type="button"
            onClick={handleChangeNumber}
            className="text-xs text-primary hover:text-primary-dark font-medium transition-colors"
          >
            Change Number
          </button>
        </div>
      </div>
    );
  }

  // State 2: OTP sent, waiting for code entry
  if (otpSent) {
    return (
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2 mb-3">
          <Phone className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
          <p className="text-sm font-medium text-text dark:text-text-dark">
            Verify Phone Number
          </p>
        </div>

        {/* Show phone (disabled) */}
        <div className="mb-3 phone-input-wrapper">
          <PhoneInput
            international
            defaultCountry="US"
            value={phone}
            onChange={() => {}}
            disabled
            className="phone-input-disabled"
          />
        </div>

        <p className="text-xs text-text-muted dark:text-text-muted-dark mb-3">
          Enter the 6-digit code sent to your phone
        </p>

        {/* OTP Input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtp(val);
            }}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2.5 text-center text-lg font-mono tracking-[0.3em]',
              'bg-background text-text dark:bg-background-dark dark:text-text-dark',
              'border-border dark:border-border-dark',
              'focus:outline-none focus:ring-2 focus:ring-primary/30'
            )}
          />
          <button
            type="button"
            onClick={handleVerifyOTP}
            disabled={loading || otp.length !== 6}
            className={cn(
              'rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors',
              'hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Verify'
            )}
          </button>
        </div>

        {/* Resend link with cooldown */}
        <div className="flex items-center gap-2">
          {cooldown > 0 ? (
            <p className="text-xs text-text-muted dark:text-text-muted-dark">
              Resend code in {cooldown}s
            </p>
          ) : (
            <button
              type="button"
              onClick={handleSendOTP}
              disabled={loading}
              className="text-xs text-primary hover:text-primary-dark font-medium transition-colors disabled:opacity-50"
            >
              Resend Code
            </button>
          )}
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }

  // State 1: No phone / not verified — enter phone number
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-2 mb-3">
        <Phone className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
        <p className="text-sm font-medium text-text dark:text-text-dark">
          Phone Number
        </p>
      </div>

      <p className="text-xs text-text-muted dark:text-text-muted-dark mb-3">
        Add your phone number to receive SMS notifications.
        Currently available for US and Canada.
      </p>

      {/* Phone Input */}
      <div className="phone-input-wrapper mb-3">
        <PhoneInput
          international
          defaultCountry="US"
          value={phone}
          onChange={(value) => setPhone(value || '')}
          className="phone-input-field"
        />
      </div>

      <button
        type="button"
        onClick={handleSendOTP}
        disabled={loading || !phone}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors',
          'hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Send className="h-4 w-4" />
            Send Verification Code
          </>
        )}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}

      {/* Dark-mode compatible styles for react-phone-number-input */}
      <style jsx global>{`
        .phone-input-wrapper .PhoneInput {
          --PhoneInput-color--focus: var(--color-primary, #6366f1);
        }
        .phone-input-wrapper .PhoneInputInput {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid;
          border-color: var(--color-border, #e2e8f0);
          background-color: var(--color-background, #ffffff);
          color: var(--color-text, #1a1a2e);
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .phone-input-wrapper .PhoneInputInput:focus {
          border-color: var(--color-primary, #6366f1);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
        .phone-input-wrapper .PhoneInputCountry {
          margin-right: 0.5rem;
        }
        .phone-input-wrapper .PhoneInputCountrySelect {
          color: var(--color-text, #1a1a2e);
          background-color: var(--color-background, #ffffff);
        }
        /* Dark mode overrides */
        [data-theme="dark"] .phone-input-wrapper .PhoneInputInput,
        .dark .phone-input-wrapper .PhoneInputInput {
          border-color: var(--color-border-dark, #374151);
          background-color: var(--color-background-dark, #1a1a2e);
          color: var(--color-text-dark, #e2e8f0);
        }
        [data-theme="dark"] .phone-input-wrapper .PhoneInputInput:focus,
        .dark .phone-input-wrapper .PhoneInputInput:focus {
          border-color: var(--color-primary, #6366f1);
        }
        [data-theme="dark"] .phone-input-wrapper .PhoneInputCountrySelect,
        .dark .phone-input-wrapper .PhoneInputCountrySelect {
          color: var(--color-text-dark, #e2e8f0);
          background-color: var(--color-background-dark, #1a1a2e);
        }
        /* Disabled state */
        .phone-input-wrapper .phone-input-disabled .PhoneInputInput {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
