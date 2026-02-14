'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2, Ban, ShieldAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

type ModerationAction = 'remove_content' | 'warn_user' | 'ban_user' | 'dismiss_report';
type BanDuration = '24h' | '7d' | '30d' | 'permanent';

interface Reporter {
  id: number;
  reporter_id: number;
  reporter_username: string;
  reporter_display_name: string;
  reason: string;
  details: string | null;
  created_at: string;
}

interface ReportGroup {
  content_type: 'post' | 'comment';
  content_id: number;
  content_preview: string;
  content_deleted: boolean;
  author: {
    id: number;
    username: string;
    display_name: string;
  } | null;
  report_count: number;
  reports: Reporter[];
  status: string;
  first_reported_at: string;
}

interface ModerationActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReportGroup | null;
  onActionComplete: (contentId: number, contentType: string) => void;
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_speech: 'Hate Speech',
  inappropriate: 'Inappropriate',
  self_harm: 'Self Harm',
  other: 'Other',
  profanity_filter: 'Auto-flagged (profanity)',
};

const BAN_DURATION_OPTIONS: { value: BanDuration; label: string }[] = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'permanent', label: 'Permanent' },
];

export function ModerationActionModal({
  isOpen,
  onClose,
  item,
  onActionComplete,
}: ModerationActionModalProps) {
  const toast = useToast();
  const [selectedAction, setSelectedAction] = useState<ModerationAction | null>(null);
  const [reason, setReason] = useState('');
  const [banDuration, setBanDuration] = useState<BanDuration>('7d');
  const [submitting, setSubmitting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  const resetState = () => {
    setSelectedAction(null);
    setReason('');
    setBanDuration('7d');
    setSubmitting(false);
    setConfirmStep(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleActionSelect = (action: ModerationAction) => {
    setSelectedAction(action);
    setConfirmStep(false);
    if (action === 'dismiss_report') {
      setReason('No action needed');
    } else {
      setReason('');
    }
  };

  const handleSubmit = async () => {
    if (!item || !selectedAction) return;

    // Require confirmation for warn/ban
    if ((selectedAction === 'warn_user' || selectedAction === 'ban_user') && !confirmStep) {
      setConfirmStep(true);
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        action: selectedAction,
        content_type: item.content_type,
        reason: reason.trim(),
      };
      if (selectedAction === 'ban_user') {
        body.ban_duration = banDuration;
      }

      const res = await fetch(`/api/admin/moderation/${item.content_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const actionLabels: Record<string, string> = {
          remove_content: 'Content removed',
          warn_user: 'Warning sent',
          ban_user: 'User banned',
          dismiss_report: 'Reports dismissed',
        };
        toast.success(actionLabels[selectedAction] || 'Action completed');
        onActionComplete(item.content_id, item.content_type);
        handleClose();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Action failed');
      }
    } catch {
      toast.error('Failed to process action');
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Take Moderation Action" size="lg">
      <div className="space-y-5">
        {/* Content Preview */}
        <div className="rounded-xl bg-background p-4 dark:bg-background-dark">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted dark:text-text-muted-dark">
            {item.content_type === 'post' ? 'Post' : 'Comment'}
            {item.content_deleted && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                DELETED
              </span>
            )}
          </div>
          {item.author && (
            <p className="mb-1 text-sm font-medium text-text dark:text-text-dark">
              @{item.author.username} ({item.author.display_name})
            </p>
          )}
          <p className="text-sm text-text dark:text-text-dark">
            {item.content_preview || 'Content unavailable'}
          </p>
        </div>

        {/* Reporter Details */}
        <div>
          <h4 className="mb-2 text-sm font-medium text-text dark:text-text-dark">
            Reports ({item.report_count})
          </h4>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {item.reports.map((report) => (
              <div
                key={report.id}
                className="flex items-start gap-2 rounded-lg bg-surface-hover p-2.5 dark:bg-surface-hover-dark"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text dark:text-text-dark">
                      @{report.reporter_username}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {REASON_LABELS[report.reason] || report.reason}
                    </span>
                  </div>
                  {report.details && (
                    <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
                      &quot;{report.details}&quot;
                    </p>
                  )}
                  <time className="text-[10px] text-text-muted dark:text-text-muted-dark">
                    {new Date(report.created_at).toLocaleString()}
                  </time>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Selection */}
        {!selectedAction && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleActionSelect('remove_content')}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              Remove Content
            </button>
            <button
              onClick={() => handleActionSelect('warn_user')}
              className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Warn User
            </button>
            <button
              onClick={() => handleActionSelect('ban_user')}
              className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 p-3 text-left text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30"
            >
              <Ban className="h-4 w-4 shrink-0" />
              Ban User
            </button>
            <button
              onClick={() => handleActionSelect('dismiss_report')}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4 shrink-0" />
              Dismiss
            </button>
          </div>
        )}

        {/* Action Form */}
        {selectedAction && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-text dark:text-text-dark">
                {selectedAction === 'remove_content' && 'Remove Content'}
                {selectedAction === 'warn_user' && 'Warn User'}
                {selectedAction === 'ban_user' && 'Ban User'}
                {selectedAction === 'dismiss_report' && 'Dismiss Reports'}
              </h4>
              <button
                onClick={() => { setSelectedAction(null); setConfirmStep(false); }}
                className="text-xs text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
              >
                Change action
              </button>
            </div>

            {/* Ban Duration Selector */}
            {selectedAction === 'ban_user' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
                  Ban Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {BAN_DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setBanDuration(opt.value)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        banDuration === opt.value
                          ? 'bg-purple-500 text-white'
                          : 'bg-surface-hover text-text-muted hover:text-text dark:bg-surface-hover-dark dark:text-text-muted-dark dark:hover:text-text-dark'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reason Textarea */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted dark:text-text-muted-dark">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  selectedAction === 'warn_user'
                    ? 'Warning message to the user...'
                    : selectedAction === 'ban_user'
                    ? 'Reason for the ban...'
                    : 'Reason for this action...'
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none dark:border-border-dark dark:bg-background-dark dark:text-text-dark dark:placeholder:text-text-muted-dark"
                rows={3}
              />
            </div>

            {/* Confirmation Warning */}
            {confirmStep && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {selectedAction === 'warn_user'
                    ? 'This will send a warning notification to the user. Confirm?'
                    : `This will ban the user ${banDuration === 'permanent' ? 'permanently' : `for ${banDuration}`}. Confirm?`}
                </p>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant={selectedAction === 'dismiss_report' ? 'secondary' : 'danger'}
                size="sm"
                loading={submitting}
                onClick={handleSubmit}
              >
                {confirmStep ? 'Yes, Confirm' : selectedAction === 'dismiss_report' ? 'Dismiss Reports' : selectedAction === 'remove_content' ? 'Remove Content' : selectedAction === 'warn_user' ? 'Send Warning' : 'Ban User'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
