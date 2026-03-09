'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Loader2 } from 'lucide-react';

interface ConversionFormProps {
  churchId: number;
  churchName: string;
  onSuccess: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function ConversionForm({
  churchId,
  churchName,
  onSuccess,
  onCancel,
  isOpen,
}: ConversionFormProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [orderDate, setOrderDate] = useState(today);
  const [estimatedSize, setEstimatedSize] = useState('');
  const [revenueEstimate, setRevenueEstimate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/church-outreach/conversions', {
          credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          churchId,
          orderDate: orderDate || null,
          estimatedSize: estimatedSize ? parseInt(estimatedSize, 10) : null,
          revenueEstimate: revenueEstimate ? parseFloat(revenueEstimate) : null,
          notes: notes.trim() || null,
        }),
      });

      if (res.status === 409) {
        setError('This church has already been marked as converted.');
        setSaving(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to record conversion');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record conversion');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={`Record Conversion - ${churchName}`} size="lg">
      <div className="space-y-4">
        {/* Order date */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
            Order Date
          </label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Estimated size */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
              Estimated Group Size
            </label>
            <input
              type="number"
              min={1}
              value={estimatedSize}
              onChange={(e) => setEstimatedSize(e.target.value)}
              placeholder="e.g., 200"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
          </div>

          {/* Revenue estimate */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
              Revenue Estimate ($)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={revenueEstimate}
              onChange={(e) => setRevenueEstimate(e.target.value)}
              placeholder="e.g., 2000.00"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes about the conversion..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Record Conversion
          </button>
        </div>
      </div>
    </Modal>
  );
}

export { ConversionForm };
