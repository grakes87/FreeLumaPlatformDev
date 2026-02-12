'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils/cn';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'self_harm', label: 'Self-harm' },
  { value: 'other', label: 'Other' },
] as const;

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'post' | 'comment';
  contentId: number;
}

export function ReportModal({
  isOpen,
  onClose,
  contentType,
  contentId,
}: ReportModalProps) {
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason) {
      setError('Please select a reason');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        content_type: contentType,
        reason,
      };

      if (contentType === 'post') body.post_id = contentId;
      if (contentType === 'comment') body.comment_id = contentId;
      if (details.trim()) body.details = details.trim();

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit report');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setDetails('');
    setError('');
    setSubmitted(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Report Content" size="sm">
      {submitted ? (
        <div className="py-4 text-center">
          <p className="text-base font-medium text-text dark:text-text-dark">
            Report submitted
          </p>
          <p className="mt-2 text-sm text-text-muted dark:text-text-muted-dark">
            Our team will review it. Thank you for helping keep our community safe.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className={cn(
              'mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white',
              'bg-primary hover:bg-primary/90'
            )}
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            Why are you reporting this {contentType}?
          </p>

          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                  reason === r.value
                    ? 'border-primary bg-primary/5 dark:border-primary dark:bg-primary/10'
                    : 'border-border hover:bg-slate-50 dark:border-border-dark dark:hover:bg-slate-800/50'
                )}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-4 w-4 text-primary accent-primary"
                />
                <span className="text-sm text-text dark:text-text-dark">
                  {r.label}
                </span>
              </label>
            ))}
          </div>

          <div>
            <label
              htmlFor="report-details"
              className="mb-1 block text-sm font-medium text-text dark:text-text-dark"
            >
              Additional details (optional)
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide more context..."
              maxLength={1000}
              rows={3}
              className={cn(
                'w-full resize-none rounded-lg border border-border p-3 text-sm',
                'bg-white text-text placeholder:text-text-muted',
                'dark:border-border-dark dark:bg-slate-900 dark:text-text-dark dark:placeholder:text-text-muted-dark',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
            />
            <span className="mt-1 block text-xs text-text-muted dark:text-text-muted-dark">
              {details.length}/1000
            </span>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium',
                'text-text-muted hover:bg-slate-100',
                'dark:text-text-muted-dark dark:hover:bg-slate-800'
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !reason}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium text-white',
                'bg-red-600 hover:bg-red-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
