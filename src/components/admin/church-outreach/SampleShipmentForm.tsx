'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Loader2 } from 'lucide-react';

interface SampleShipmentFormProps {
  churchId: number;
  churchName: string;
  onSuccess: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

const CARRIERS = ['usps', 'ups', 'fedex', 'other'] as const;

export default function SampleShipmentForm({
  churchId,
  churchName,
  onSuccess,
  onCancel,
  isOpen,
}: SampleShipmentFormProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [shipDate, setShipDate] = useState(today);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState<string>('usps');
  const [braceletType, setBraceletType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/church-outreach/samples', {
          credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          churchId,
          shipDate,
          trackingNumber: trackingNumber.trim() || null,
          carrier,
          braceletType: braceletType.trim() || null,
          quantity: quantity ? parseInt(quantity, 10) : null,
          shippingAddress: shippingAddress.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to log shipment');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log shipment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={`Log Sample Shipment - ${churchName}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Ship date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
              Ship Date
            </label>
            <input
              type="date"
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
          </div>

          {/* Carrier */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
              Carrier
            </label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            >
              {CARRIERS.map((c) => (
                <option key={c} value={c}>{c.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tracking number */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
            Tracking Number
          </label>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Bracelet type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
              Bracelet Type
            </label>
            <input
              type="text"
              value={braceletType}
              onChange={(e) => setBraceletType(e.target.value)}
              placeholder="e.g., Standard, Premium"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g., 50"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            />
          </div>
        </div>

        {/* Shipping address */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
            Shipping Address
          </label>
          <textarea
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            rows={2}
            placeholder="Optional"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional"
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
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Log Shipment
          </button>
        </div>
      </div>
    </Modal>
  );
}

export { SampleShipmentForm };
