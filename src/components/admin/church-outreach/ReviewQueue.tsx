'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Check,
  X,
  Edit3,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Inbox,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewEmail {
  id: number;
  church_id: number;
  to_email: string;
  subject: string;
  ai_subject: string | null;
  ai_html: string | null;
  rendered_html: string | null;
  status: string;
  tracking_id: string;
  drip_enrollment_id: number | null;
  created_at: string;
  church?: {
    id: number;
    name: string;
    city: string | null;
    state: string | null;
    denomination: string | null;
    pastor_name: string | null;
    contact_email: string | null;
    pipeline_stage: string;
    outreach_fit_score: number | null;
  };
  template?: {
    id: number;
    name: string;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReviewQueue() {
  const [emails, setEmails] = useState<ReviewEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | 'batch' | null>(null);

  // Edit modal state
  const [editingEmail, setEditingEmail] = useState<ReviewEmail | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editHtml, setEditHtml] = useState('');

  // Preview modal state
  const [previewEmail, setPreviewEmail] = useState<ReviewEmail | null>(null);

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve_all' | 'reject_all'; ids?: number[] } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/church-outreach/review?page=${page}&limit=20`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEmails(data.emails || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch review queue:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  // Single email actions
  const handleApprove = async (emailId: number) => {
    setProcessing(emailId);
    try {
      const res = await fetch(`/api/admin/church-outreach/review/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      await fetchEmails();
    } catch (err) {
      console.error('Failed to approve email:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (emailId: number, reason?: string) => {
    setProcessing(emailId);
    try {
      const res = await fetch(`/api/admin/church-outreach/review/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reject', rejectionReason: reason }),
      });
      if (!res.ok) throw new Error('Failed to reject');
      await fetchEmails();
    } catch (err) {
      console.error('Failed to reject email:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleEditApprove = async () => {
    if (!editingEmail) return;
    setProcessing(editingEmail.id);
    try {
      const res = await fetch(`/api/admin/church-outreach/review/${editingEmail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'edit_approve', subject: editSubject, html: editHtml }),
      });
      if (!res.ok) throw new Error('Failed to edit+approve');
      setEditingEmail(null);
      await fetchEmails();
    } catch (err) {
      console.error('Failed to edit+approve email:', err);
    } finally {
      setProcessing(null);
    }
  };

  // Batch actions
  const handleBatchAction = async (action: 'approve_all' | 'reject_all') => {
    setProcessing('batch');
    try {
      const res = await fetch('/api/admin/church-outreach/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          rejectionReason: action === 'reject_all' ? rejectReason : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Failed to ${action}`);
      setConfirmAction(null);
      setRejectReason('');
      await fetchEmails();
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    } finally {
      setProcessing(null);
    }
  };

  const openEdit = (email: ReviewEmail) => {
    setEditingEmail(email);
    setEditSubject(email.ai_subject || email.subject);
    setEditHtml(email.ai_html || email.rendered_html || '');
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading && emails.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Empty state
  if (emails.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
        <h3 className="text-lg font-semibold text-text dark:text-text-dark">Review queue is clear</h3>
        <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
          No emails pending review. New drip emails will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with batch actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          {total} email{total !== 1 ? 's' : ''} pending review
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmAction({ type: 'approve_all' })}
            disabled={processing !== null}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve All
          </button>
          <button
            onClick={() => setConfirmAction({ type: 'reject_all' })}
            disabled={processing !== null}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject All
          </button>
        </div>
      </div>

      {/* Email cards */}
      <div className="space-y-3">
        {emails.map((email) => (
          <div
            key={email.id}
            className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Church info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate font-semibold text-text dark:text-text-dark">
                    {email.church?.name || 'Unknown Church'}
                  </h4>
                  {email.church?.outreach_fit_score && (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      email.church.outreach_fit_score >= 7
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : email.church.outreach_fit_score >= 4
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    )}>
                      Fit: {email.church.outreach_fit_score}/10
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark">
                  {[email.church?.city, email.church?.state].filter(Boolean).join(', ')}
                  {email.church?.denomination && ` · ${email.church.denomination}`}
                  {email.church?.pastor_name && ` · Pastor ${email.church.pastor_name}`}
                </p>
                <p className="mt-1 text-sm text-text dark:text-text-dark">
                  <span className="font-medium">Subject:</span> {email.ai_subject || email.subject}
                </p>
                {email.template && (
                  <p className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark">
                    Template: {email.template.name}
                    {email.drip_enrollment_id && ' · Drip sequence'}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => setPreviewEmail(email)}
                  className="rounded-lg p-2 text-text-muted hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
                  title="Preview"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => openEdit(email)}
                  disabled={processing !== null}
                  className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  title="Edit & Approve"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleApprove(email.id)}
                  disabled={processing !== null}
                  className="rounded-lg p-2 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                  title="Approve"
                >
                  {processing === email.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleReject(email.id)}
                  disabled={processing !== null}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  title="Reject"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg p-2 text-text-muted hover:bg-surface-hover disabled:opacity-30 dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-text-muted dark:text-text-muted-dark">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg p-2 text-text-muted hover:bg-surface-hover disabled:opacity-30 dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Batch confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl dark:bg-surface-dark">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className={cn(
                'h-6 w-6',
                confirmAction.type === 'approve_all' ? 'text-green-600' : 'text-red-600'
              )} />
              <h3 className="text-lg font-semibold text-text dark:text-text-dark">
                {confirmAction.type === 'approve_all' ? 'Approve All Emails?' : 'Reject All Emails?'}
              </h3>
            </div>
            <p className="text-sm text-text-muted dark:text-text-muted-dark mb-4">
              {confirmAction.type === 'approve_all'
                ? `This will send ${total} email${total !== 1 ? 's' : ''} via SendGrid immediately.`
                : `This will reject ${total} email${total !== 1 ? 's' : ''} and skip the current drip step.`
              }
            </p>
            {confirmAction.type === 'reject_all' && (
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Rejection reason (optional)"
                className="mb-4 w-full rounded-lg border border-border bg-surface-hover p-2 text-sm text-text dark:border-border-dark dark:bg-surface-hover-dark dark:text-text-dark"
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setConfirmAction(null); setRejectReason(''); }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBatchAction(confirmAction.type)}
                disabled={processing === 'batch'}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                  confirmAction.type === 'approve_all' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                )}
              >
                {processing === 'batch' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  confirmAction.type === 'approve_all' ? 'Confirm Approve All' : 'Confirm Reject All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-xl bg-surface shadow-xl dark:bg-surface-dark">
            <div className="flex items-center justify-between border-b border-border p-4 dark:border-border-dark">
              <div>
                <h3 className="font-semibold text-text dark:text-text-dark">
                  Email Preview — {previewEmail.church?.name}
                </h3>
                <p className="text-sm text-text-muted dark:text-text-muted-dark">
                  Subject: {previewEmail.ai_subject || previewEmail.subject}
                </p>
              </div>
              <button
                onClick={() => setPreviewEmail(null)}
                className="rounded-lg p-2 text-text-muted hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                srcDoc={previewEmail.ai_html || previewEmail.rendered_html || '<p>No content</p>'}
                className="h-full w-full rounded border border-border dark:border-border-dark"
                title="Email preview"
                sandbox=""
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-surface shadow-xl dark:bg-surface-dark">
            <div className="flex items-center justify-between border-b border-border p-4 dark:border-border-dark">
              <h3 className="font-semibold text-text dark:text-text-dark">
                Edit Email — {editingEmail.church?.name}
              </h3>
              <button
                onClick={() => setEditingEmail(null)}
                className="rounded-lg p-2 text-text-muted hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                  Subject
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-hover p-2 text-sm text-text dark:border-border-dark dark:bg-surface-hover-dark dark:text-text-dark"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                  HTML Body
                </label>
                <textarea
                  value={editHtml}
                  onChange={(e) => setEditHtml(e.target.value)}
                  rows={16}
                  className="w-full rounded-lg border border-border bg-surface-hover p-2 font-mono text-xs text-text dark:border-border-dark dark:bg-surface-hover-dark dark:text-text-dark"
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-text dark:text-text-dark">Preview</p>
                <iframe
                  srcDoc={editHtml}
                  className="h-48 w-full rounded border border-border dark:border-border-dark"
                  title="Edit preview"
                  sandbox=""
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-4 dark:border-border-dark">
              <button
                onClick={() => setEditingEmail(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-hover dark:text-text-muted-dark dark:hover:bg-surface-hover-dark"
              >
                Cancel
              </button>
              <button
                onClick={handleEditApprove}
                disabled={processing !== null}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {processing === editingEmail.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save & Approve'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
