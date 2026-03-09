'use client';

/**
 * Placeholder ChurchDetailModal -- will be replaced by plan 15-09
 * with full edit form, activity timeline, and pipeline stage selector.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, MapPin, Phone, Mail, Globe, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface ChurchDetailModalProps {
  churchId: number;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

interface ChurchDetail {
  id: number;
  name: string;
  pastor_name: string | null;
  denomination: string | null;
  city: string | null;
  state: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  youth_programs: string[] | null;
  pipeline_stage: string;
  notes: string | null;
  ai_summary: string | null;
  congregation_size_estimate: string | null;
  address_line1: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  activities?: Array<{
    id: number;
    activity_type: string;
    description: string;
    created_at: string;
  }>;
}

const PIPELINE_STAGES = [
  'new_lead',
  'contacted',
  'engaged',
  'sample_requested',
  'sample_sent',
  'converted',
  'lost',
] as const;

function formatStageLabel(stage: string): string {
  return stage
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Named export for direct imports, default export for lazy loading
export function ChurchDetailModal({
  churchId,
  isOpen,
  onClose,
  onUpdate,
}: ChurchDetailModalProps) {
  const toast = useToast();
  const [church, setChurch] = useState<ChurchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState('');

  const fetchChurch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/church-outreach/churches/${churchId}`);
      if (!res.ok) throw new Error('Failed to fetch church');
      const data = await res.json();
      const c = data.data?.church;
      setChurch(c);
      setNotes(c?.notes || '');
      setStage(c?.pipeline_stage || 'new_lead');
    } catch {
      toast.error('Failed to load church details');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [churchId, toast, onClose]);

  useEffect(() => {
    if (isOpen && churchId) {
      fetchChurch();
    }
  }, [isOpen, churchId, fetchChurch]);

  const handleSave = useCallback(async () => {
    if (!church) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/church-outreach/churches/${church.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, pipeline_stage: stage }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Church updated');
      onUpdate();
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [church, notes, stage, toast, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (!church || !confirm('Delete this church? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/church-outreach/churches/${church.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Church deleted');
      onUpdate();
    } catch {
      toast.error('Failed to delete church');
    }
  }, [church, toast, onUpdate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={cn(
          'relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl',
          'dark:bg-surface-dark'
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-text-muted hover:bg-slate-100 dark:text-text-muted-dark dark:hover:bg-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : church ? (
          <div className="space-y-5">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-text dark:text-text-dark">
                {church.name}
              </h2>
              {church.denomination && (
                <p className="text-sm text-text-muted dark:text-text-muted-dark">
                  {church.denomination}
                </p>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(church.city || church.state) && (
                <div className="flex items-center gap-2 text-sm text-text dark:text-text-dark">
                  <MapPin className="h-4 w-4 text-text-muted" />
                  {[church.address_line1, church.city, church.state].filter(Boolean).join(', ')}
                </div>
              )}
              {church.pastor_name && (
                <div className="flex items-center gap-2 text-sm text-text dark:text-text-dark">
                  <User className="h-4 w-4 text-text-muted" />
                  Pastor: {church.pastor_name}
                </div>
              )}
              {church.contact_email && (
                <div className="flex items-center gap-2 text-sm text-text dark:text-text-dark">
                  <Mail className="h-4 w-4 text-text-muted" />
                  {church.contact_email}
                </div>
              )}
              {church.contact_phone && (
                <div className="flex items-center gap-2 text-sm text-text dark:text-text-dark">
                  <Phone className="h-4 w-4 text-text-muted" />
                  {church.contact_phone}
                </div>
              )}
              {church.website_url && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-text-muted" />
                  <a
                    href={church.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {church.website_url}
                  </a>
                </div>
              )}
              {church.congregation_size_estimate && (
                <div className="text-sm text-text dark:text-text-dark">
                  Size: {church.congregation_size_estimate}
                </div>
              )}
            </div>

            {/* Youth programs */}
            {church.youth_programs && church.youth_programs.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-text-muted dark:text-text-muted-dark">
                  Youth Programs
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {church.youth_programs.map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summary */}
            {church.ai_summary && (
              <div>
                <p className="mb-1 text-xs font-medium text-text-muted dark:text-text-muted-dark">
                  AI Research Summary
                </p>
                <p className="text-sm text-text dark:text-text-dark">
                  {church.ai_summary}
                </p>
              </div>
            )}

            {/* Pipeline stage selector */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
                Pipeline Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {formatStageLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                placeholder="Admin notes..."
              />
            </div>

            {/* Activity timeline */}
            {church.activities && church.activities.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-text-muted dark:text-text-muted-dark">
                  Recent Activity
                </p>
                <div className="space-y-2">
                  {church.activities.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-2 text-xs text-text-muted dark:text-text-muted-dark"
                    >
                      <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="text-text dark:text-text-dark">{a.description}</p>
                        <p>{new Date(a.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-border pt-4 dark:border-border-dark">
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} loading={saving}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ChurchDetailModal;
