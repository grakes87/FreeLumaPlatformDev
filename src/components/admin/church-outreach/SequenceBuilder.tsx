'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Loader2, Plus, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Template {
  id: number;
  name: string;
  subject: string;
}

interface StepInput {
  templateId: number | '';
  delayDays: number;
}

interface SequenceData {
  id?: number;
  name: string;
  description: string | null;
  trigger: 'manual' | 'sample_shipped' | 'stage_change';
  steps?: Array<{
    template_id: number;
    delay_days: number;
    template?: { id: number; name: string; subject: string };
  }>;
}

interface SequenceBuilderProps {
  sequence?: SequenceData | null;
  initialSteps?: Array<{
    template_id: number;
    delay_days: number;
    template?: { id: number; name: string; subject: string };
  }>;
  onSave: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SequenceBuilder({
  sequence,
  initialSteps,
  onSave,
  onCancel,
  isOpen,
}: SequenceBuilderProps) {
  const [name, setName] = useState(sequence?.name || '');
  const [description, setDescription] = useState(sequence?.description || '');
  const [trigger, setTrigger] = useState<'manual' | 'sample_shipped' | 'stage_change'>(
    sequence?.trigger || 'manual'
  );
  const [steps, setSteps] = useState<StepInput[]>(() => {
    if (initialSteps && initialSteps.length > 0) {
      return initialSteps.map((s) => ({
        templateId: s.template_id,
        delayDays: s.delay_days,
      }));
    }
    return [{ templateId: '', delayDays: 0 }];
  });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates for step dropdowns
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/church-outreach/templates', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(data.data?.templates ?? data.templates ?? []);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const addStep = () => {
    setSteps((prev) => [...prev, { templateId: '', delayDays: 1 }]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof StepInput, value: number | string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Sequence name is required');
      return;
    }

    const validSteps = steps.filter((s) => s.templateId !== '');
    if (validSteps.length === 0) {
      setError('At least one step with a template is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = sequence?.id
        ? `/api/admin/church-outreach/sequences/${sequence.id}`
        : '/api/admin/church-outreach/sequences';
      const method = sequence?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          trigger,
          steps: validSteps.map((s) => ({
            templateId: Number(s.templateId),
            delayDays: s.delayDays,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to save sequence');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sequence');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={sequence?.id ? 'Edit Sequence' : 'New Drip Sequence'} size="xl">
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
            Sequence Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Post-Sample Follow-Up"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional description..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
          />
        </div>

        {/* Trigger type */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
            Trigger Type
          </label>
          <div className="flex gap-3">
            {(['manual', 'sample_shipped', 'stage_change'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-text dark:text-text-dark">
                <input
                  type="radio"
                  name="trigger"
                  value={t}
                  checked={trigger === t}
                  onChange={() => setTrigger(t)}
                  className="text-primary focus:ring-primary"
                />
                {t === 'manual' ? 'Manual' : t === 'sample_shipped' ? 'Sample Shipped' : 'Stage Change'}
              </label>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div>
          <label className="mb-2 block text-sm font-medium text-text dark:text-text-dark">
            Steps
          </label>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-hover/50 p-3 dark:border-border-dark dark:bg-surface-hover-dark/50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {index + 1}
                </span>

                <select
                  value={step.templateId}
                  onChange={(e) => updateStep(index, 'templateId', e.target.value ? Number(e.target.value) : '')}
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                >
                  <option value="">Select template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted dark:text-text-muted-dark">after</span>
                  <input
                    type="number"
                    min={0}
                    value={step.delayDays}
                    onChange={(e) => updateStep(index, 'delayDays', parseInt(e.target.value) || 0)}
                    className="w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                  />
                  <span className="text-xs text-text-muted dark:text-text-muted-dark">days</span>
                </div>

                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="rounded-lg p-1 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addStep}
            className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="h-4 w-4" /> Add Step
          </button>
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
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {sequence?.id ? 'Update Sequence' : 'Create Sequence'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export { SequenceBuilder };
