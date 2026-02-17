'use client';

import { useState, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  Eye,
  Calendar,
  User as UserIcon,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { DayData } from './DayCard';

interface CompletedTabProps {
  days: DayData[];
  onRefresh: () => void;
}

export function CompletedTab({ days, onRefresh }: CompletedTabProps) {
  const toast = useToast();
  const [actionId, setActionId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [previewDay, setPreviewDay] = useState<DayData | null>(null);

  const awaiting = useMemo(
    () => days.filter((d) => d.status === 'submitted'),
    [days]
  );
  const approved = useMemo(
    () => days.filter((d) => d.status === 'approved'),
    [days]
  );

  const formatDate = (postDate: string) =>
    new Date(postDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const handleReview = async (
    dailyContentId: number,
    action: 'approve' | 'reject' | 'revert',
    note?: string
  ) => {
    setActionId(dailyContentId);
    try {
      const body: Record<string, unknown> = {
        daily_content_id: dailyContentId,
        action,
      };
      if (action === 'reject' && note) {
        body.rejection_note = note;
      }

      const res = await fetch('/api/admin/content-production/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action} failed`);

      const labels = { approve: 'Approved', reject: 'Rejected', revert: 'Reverted' };
      toast.success(`Content ${labels[action].toLowerCase()} successfully`);
      setRejectingId(null);
      setRejectionNote('');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Awaiting Review */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          <MessageSquare className="h-4 w-4" />
          Awaiting Review ({awaiting.length})
        </h3>

        {awaiting.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-8 text-text-muted dark:border-border-dark dark:text-text-muted-dark">
            <CheckCircle className="h-8 w-8" />
            <p className="text-sm">No content awaiting review.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {awaiting.map((day) => (
              <div
                key={day.id}
                className="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
              >
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Calendar className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
                  <span className="min-w-[7rem] text-sm font-medium text-text dark:text-text-dark">
                    {formatDate(day.post_date)}
                  </span>
                  {day.creator && (
                    <span className="flex items-center gap-1 text-xs text-text-muted dark:text-text-muted-dark">
                      <UserIcon className="h-3 w-3" />
                      {day.creator.name}
                    </span>
                  )}
                  {day.title && (
                    <span className="hidden truncate text-sm text-text-muted sm:block dark:text-text-muted-dark">
                      {day.title}
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewDay(day)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={actionId === day.id}
                      onClick={() => handleReview(day.id, 'approve')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </Button>
                    {rejectingId === day.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={rejectionNote}
                          onChange={(e) => setRejectionNote(e.target.value)}
                          placeholder="Rejection reason..."
                          className={cn(
                            'w-48 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text',
                            'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50',
                            'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                          )}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && rejectionNote.trim()) {
                              handleReview(day.id, 'reject', rejectionNote.trim());
                            }
                            if (e.key === 'Escape') {
                              setRejectingId(null);
                              setRejectionNote('');
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!rejectionNote.trim()}
                          loading={actionId === day.id}
                          onClick={() => handleReview(day.id, 'reject', rejectionNote.trim())}
                        >
                          Send
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectionNote('');
                          }}
                          className="text-xs text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setRejectingId(day.id)}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Approved */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          Approved ({approved.length})
        </h3>

        {approved.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-8 text-text-muted dark:border-border-dark dark:text-text-muted-dark">
            <CheckCircle className="h-8 w-8" />
            <p className="text-sm">No approved content yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {approved.map((day) => (
              <div
                key={day.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
              >
                <Calendar className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
                <span className="min-w-[7rem] text-sm font-medium text-text dark:text-text-dark">
                  {formatDate(day.post_date)}
                </span>
                {day.creator && (
                  <span className="flex items-center gap-1 text-xs text-text-muted dark:text-text-muted-dark">
                    <UserIcon className="h-3 w-3" />
                    {day.creator.name}
                  </span>
                )}
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  APPROVED
                </span>
                {day.title && (
                  <span className="hidden truncate text-sm text-text-muted sm:block dark:text-text-muted-dark">
                    {day.title}
                  </span>
                )}

                <div className="ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={actionId === day.id}
                    onClick={() => handleReview(day.id, 'revert')}
                    className="border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Revert
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Preview Modal */}
      <Modal
        isOpen={previewDay !== null}
        onClose={() => setPreviewDay(null)}
        title={previewDay ? `Preview - ${formatDate(previewDay.post_date)}` : undefined}
        size="lg"
      >
        {previewDay && <ContentPreview day={previewDay} />}
      </Modal>
    </div>
  );
}

/* ─── Simple Content Preview ─── */

function ContentPreview({ day }: { day: DayData }) {
  return (
    <div className="space-y-4">
      {/* Verse / Quote Slide */}
      <div className="rounded-xl border border-border bg-gradient-to-b from-primary/5 to-transparent p-4 dark:border-border-dark">
        <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
          Slide 1 - Verse / Quote
        </p>
        {day.title && (
          <p className="mt-2 text-lg font-semibold text-text dark:text-text-dark">
            {day.title}
          </p>
        )}
        {day.verse_reference && (
          <p className="mt-1 text-sm text-primary">{day.verse_reference}</p>
        )}
      </div>

      {/* Devotional / Meditation Slide */}
      <div className="rounded-xl border border-border bg-gradient-to-b from-purple-50/50 to-transparent p-4 dark:border-border-dark dark:from-purple-900/10">
        <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
          Slide 2 - Devotional / Meditation
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {day.has_devotional && (
            <span className="rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Devotional ready
            </span>
          )}
          {day.has_meditation && (
            <span className="rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Meditation ready
            </span>
          )}
          {day.has_camera_script && (
            <span className="rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Camera script ready
            </span>
          )}
        </div>
      </div>

      {/* Video Slide */}
      <div className="rounded-xl border border-border bg-gradient-to-b from-slate-50/50 to-transparent p-4 dark:border-border-dark dark:from-slate-800/30">
        <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
          Slide 3 - Video
        </p>
        <div className="mt-2">
          {day.has_creator_video ? (
            <span className="rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Creator video uploaded
            </span>
          ) : (
            <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              No creator video
            </span>
          )}
        </div>
        {day.has_background_prompt && (
          <span className="mt-2 inline-block rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            Background prompt ready
          </span>
        )}
      </div>

      {/* Translation status */}
      {day.translations.length > 0 && (
        <div className="rounded-xl border border-border p-4 dark:border-border-dark">
          <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
            Translations
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {day.translations.map((t) => (
              <span
                key={t.translation_code}
                className={cn(
                  'rounded-lg px-2 py-1 text-xs font-medium',
                  t.has_audio && t.has_srt && t.has_chapter_text
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                )}
              >
                {t.translation_code}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
