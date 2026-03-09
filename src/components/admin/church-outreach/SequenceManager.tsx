'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Plus,
  Trash2,
  Pause,
  Play,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import SequenceBuilder from './SequenceBuilder';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Sequence {
  id: number;
  name: string;
  description: string | null;
  trigger: 'manual' | 'sample_shipped' | 'stage_change';
  is_active: boolean;
  created_at: string;
  step_count?: number;
  enrollment_count?: number;
  active_enrollment_count?: number;
}

interface SequenceStep {
  id: number;
  sequence_id: number;
  step_order: number;
  template_id: number;
  delay_days: number;
  template?: { id: number; name: string; subject: string };
}

interface Enrollment {
  id: number;
  church_id: number;
  sequence_id: number;
  current_step: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  next_step_at: string | null;
  enrolled_at: string;
  church?: { id: number; name: string };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  sample_shipped: 'Sample Shipped',
  stage_change: 'Stage Change',
};

const ENROLLMENT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SequenceManager() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Builder modal
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [editingSteps, setEditingSteps] = useState<SequenceStep[]>([]);

  // Enrollment view
  const [expandedSequenceId, setExpandedSequenceId] = useState<number | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Enroll search
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrollResults, setEnrollResults] = useState<Array<{ id: number; name: string }>>([]);
  const [enrolling, setEnrolling] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const fetchSequences = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/church-outreach/sequences', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load sequences');
      const data = await res.json();
      setSequences(data.data?.sequences ?? data.sequences ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sequences');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  // ---------------------------------------------------------------------------
  // Enrollment view
  // ---------------------------------------------------------------------------

  const toggleEnrollments = async (seqId: number) => {
    if (expandedSequenceId === seqId) {
      setExpandedSequenceId(null);
      return;
    }

    setExpandedSequenceId(seqId);
    setEnrollmentLoading(true);

    try {
      const res = await fetch(`/api/admin/church-outreach/sequences/${seqId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load details');
      const data = await res.json();
      const detail = data.data ?? data;
      setEditingSteps(detail.steps ?? []);

      // Fetch enrollments from the churches endpoint with sequence filter
      // For now we use the sequence detail to get counts; individual enrollment management
      // is handled via the enroll endpoint
    } catch {
      // Non-critical
    } finally {
      setEnrollmentLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Sequence actions
  // ---------------------------------------------------------------------------

  const toggleActive = async (seq: Sequence) => {
    try {
      const res = await fetch(`/api/admin/church-outreach/sequences/${seq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !seq.is_active }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      await fetchSequences();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sequence');
    }
  };

  const handleDelete = async (seqId: number) => {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/church-outreach/sequences/${seqId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        setDeleteError(data?.error || 'Sequence has active enrollments');
        return;
      }
      if (!res.ok) throw new Error('Failed to delete');
      setDeleteConfirmId(null);
      await fetchSequences();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete sequence');
    }
  };

  const openEdit = async (seq: Sequence) => {
    try {
      const res = await fetch(`/api/admin/church-outreach/sequences/${seq.id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const detail = data.data ?? data;
      setEditingSequence(detail.sequence);
      setEditingSteps(detail.steps ?? []);
      setShowBuilder(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sequence');
    }
  };

  // ---------------------------------------------------------------------------
  // Enrollment actions
  // ---------------------------------------------------------------------------

  const handleEnrollmentAction = async (
    seqId: number,
    enrollmentId: number,
    action: 'pause' | 'resume' | 'cancel'
  ) => {
    try {
      const res = await fetch(`/api/admin/church-outreach/sequences/${seqId}/enroll`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enrollmentId, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to ${action}`);
      }
      await fetchSequences();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} enrollment`);
    }
  };

  const searchChurches = async (query: string) => {
    setEnrollSearch(query);
    if (query.length < 2) {
      setEnrollResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/church-outreach/churches?search=${encodeURIComponent(query)}&limit=5`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      const churches = data.data?.churches ?? data.churches ?? [];
      setEnrollResults(churches.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })));
    } catch {
      // Non-critical
    }
  };

  const enrollChurch = async (seqId: number, churchId: number) => {
    setEnrolling(true);
    try {
      const res = await fetch(`/api/admin/church-outreach/sequences/${seqId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ churchId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to enroll');
      }
      setEnrollSearch('');
      setEnrollResults([]);
      await fetchSequences();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll church');
    } finally {
      setEnrolling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text dark:text-text-dark">Drip Sequences</h3>
        <div className="flex gap-2">
          <button
            onClick={() => { setLoading(true); fetchSequences(); }}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-text-muted transition-colors hover:text-text dark:border-border-dark dark:text-text-muted-dark dark:hover:text-text-dark"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setEditingSequence(null); setEditingSteps([]); setShowBuilder(true); }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Sequence
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Sequence list */}
      {sequences.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center dark:border-border-dark dark:bg-surface-dark">
          <Zap className="mx-auto mb-3 h-10 w-10 text-text-muted/40 dark:text-text-muted-dark/40" />
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            No drip sequences yet. Create one to automate follow-up emails.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <div
              key={seq.id}
              className="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
            >
              {/* Sequence card */}
              <div className="flex items-center gap-4 p-4">
                {/* Active toggle */}
                <button
                  type="button"
                  onClick={() => toggleActive(seq)}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                    seq.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  )}
                >
                  <span
                    className={cn(
                      'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm',
                      seq.is_active && 'translate-x-5'
                    )}
                  />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => openEdit(seq)}
                    className="text-left font-semibold text-text hover:underline dark:text-text-dark"
                  >
                    {seq.name}
                  </button>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-muted dark:text-text-muted-dark">
                    <span className="rounded-full border border-border px-2 py-0.5 dark:border-border-dark">
                      {TRIGGER_LABELS[seq.trigger] || seq.trigger}
                    </span>
                    <span>{seq.step_count ?? 0} steps</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {seq.active_enrollment_count ?? 0} active
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleEnrollments(seq.id)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text dark:border-border-dark dark:text-text-muted-dark"
                  >
                    {expandedSequenceId === seq.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Enrollments
                  </button>

                  {deleteConfirmId === seq.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(seq.id)}
                        className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setDeleteConfirmId(null); setDeleteError(null); }}
                        className="rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:text-text dark:text-text-muted-dark"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(seq.id)}
                      className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Delete error */}
              {deleteConfirmId === seq.id && deleteError && (
                <div className="flex items-center gap-2 border-t border-border px-4 py-2 dark:border-border-dark">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">{deleteError}</p>
                </div>
              )}

              {/* Expanded enrollment view */}
              {expandedSequenceId === seq.id && (
                <div className="border-t border-border p-4 dark:border-border-dark">
                  {enrollmentLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Enroll church search */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
                          Enroll a Church
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={enrollSearch}
                            onChange={(e) => searchChurches(e.target.value)}
                            placeholder="Search church name..."
                            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
                          />
                          {enrollResults.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border bg-surface shadow-lg dark:border-border-dark dark:bg-surface-dark">
                              {enrollResults.map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => enrollChurch(seq.id, c.id)}
                                  disabled={enrolling}
                                  className="block w-full px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface-hover dark:text-text-dark dark:hover:bg-surface-hover-dark"
                                >
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-text-muted dark:text-text-muted-dark">
                        Total enrollments: {seq.enrollment_count ?? 0} ({seq.active_enrollment_count ?? 0} active)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sequence builder modal */}
      {showBuilder && (
        <SequenceBuilder
          sequence={editingSequence}
          initialSteps={editingSteps}
          onSave={() => {
            setShowBuilder(false);
            setEditingSequence(null);
            setEditingSteps([]);
            fetchSequences();
          }}
          onCancel={() => {
            setShowBuilder(false);
            setEditingSequence(null);
            setEditingSteps([]);
          }}
          isOpen={showBuilder}
        />
      )}
    </div>
  );
}

export { SequenceManager };
