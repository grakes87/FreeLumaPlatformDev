'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Calendar, BookOpen, Sparkles, Video, FileText, Music, Subtitles, AlertCircle, Upload, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Assignment } from './CreatorDashboard';

interface AssignmentListProps {
  assignments: Assignment[];
  loading?: boolean;
  onSelectAssignment?: (id: number) => void;
  onUploadComplete?: () => void;
}

const STATUS_CONFIG: Record<
  Assignment['status'],
  { label: string; bg: string; text: string }
> = {
  rejected: { label: 'Rejected', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  assigned: { label: 'Assigned', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  submitted: { label: 'Submitted', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  approved: { label: 'Approved', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  generated: { label: 'Generated', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  empty: { label: 'Empty', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
};

const STATUS_ORDER: Assignment['status'][] = ['rejected', 'assigned', 'submitted', 'approved', 'generated', 'empty'];

function sortByStatus(a: Assignment, b: Assignment): number {
  const ai = STATUS_ORDER.indexOf(a.status);
  const bi = STATUS_ORDER.indexOf(b.status);
  if (ai !== bi) return ai - bi;
  return a.post_date.localeCompare(b.post_date);
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="mt-2 h-4 w-48 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-2 flex gap-2">
        <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export function AssignmentList({ assignments, loading, onSelectAssignment, onUploadComplete }: AssignmentListProps) {
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAssignmentRef = useRef<number | null>(null);

  const handleUploadClick = useCallback((e: React.MouseEvent, assignmentId: number) => {
    e.stopPropagation();
    e.preventDefault();
    pendingAssignmentRef.current = assignmentId;
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const assignmentId = pendingAssignmentRef.current;
    if (!file || !assignmentId) return;

    // Reset input so the same file can be re-selected
    e.target.value = '';

    setUploadingId(assignmentId);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('daily_content_id', String(assignmentId));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/creator/upload');

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        setUploadProgress(Math.round((evt.loaded / evt.total) * 70));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress(100);
        setUploadingId(null);
        setUploadSuccess(assignmentId);
        setTimeout(() => {
          setUploadSuccess(null);
          onUploadComplete?.();
        }, 1500);
      } else {
        let msg = 'Upload failed';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* ignore */ }
        setUploadError(msg);
        setUploadingId(null);
      }
    };

    xhr.onerror = () => {
      setUploadError('Network error — please try again');
      setUploadingId(null);
    };

    // After upload completes, server compresses — show progress at 70%+
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE && uploadProgress < 70) return;
      if (xhr.readyState === XMLHttpRequest.LOADING) {
        setUploadProgress(85);
      }
    };

    xhr.send(formData);
  }, [onUploadComplete, uploadProgress]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 dark:border-border-dark">
        <Calendar className="h-10 w-10 text-text-muted dark:text-text-muted-dark" />
        <p className="mt-3 text-sm text-text-muted dark:text-text-muted-dark">
          No assignments for this month
        </p>
      </div>
    );
  }

  const sorted = [...assignments].sort(sortByStatus);
  const canRecord = (status: string) => status === 'assigned' || status === 'rejected';
  const canView = (status: string) => status === 'submitted';
  const isInteractive = (status: string) => canRecord(status) || canView(status);

  return (
    <div className="space-y-3">
      {/* Hidden file input shared across all tiles */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Upload error banner */}
      {uploadError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-950/30">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">{uploadError}</p>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {sorted.map((assignment) => {
        const statusCfg = STATUS_CONFIG[assignment.status];
        const isUploading = uploadingId === assignment.id;
        const justSucceeded = uploadSuccess === assignment.id;

        // Recordable assignments link straight to the recording screen
        // Submitted assignments open the detail overlay to watch / re-record
        const Wrapper = canRecord(assignment.status)
          ? ({ children, className }: { children: React.ReactNode; className: string }) => (
              <Link
                href={`/creator/record/${assignment.id}`}
                className={className}
              >
                {children}
              </Link>
            )
          : canView(assignment.status)
            ? ({ children, className }: { children: React.ReactNode; className: string }) => (
                <button
                  type="button"
                  onClick={() => onSelectAssignment?.(assignment.id)}
                  className={className}
                >
                  {children}
                </button>
              )
            : ({ children, className }: { children: React.ReactNode; className: string }) => (
                <div className={className}>{children}</div>
              );

        return (
          <Wrapper
            key={assignment.id}
            className={cn(
              'block w-full rounded-xl border border-border bg-surface p-4 text-left dark:border-border-dark dark:bg-surface-dark',
              isInteractive(assignment.status) && 'transition-colors hover:bg-surface-hover dark:hover:bg-surface-hover-dark cursor-pointer'
            )}
          >
            {/* Top row: date + status badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text dark:text-text-dark">
                {formatDate(assignment.post_date)}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  statusCfg.bg,
                  statusCfg.text
                )}
              >
                {assignment.status === 'rejected' && (
                  <AlertCircle className="mr-1 h-3 w-3" />
                )}
                {statusCfg.label}
              </span>
            </div>

            {/* Title / verse */}
            <p className="mt-1.5 text-sm text-text-muted line-clamp-1 dark:text-text-muted-dark">
              {assignment.title}
              {assignment.verse_reference && (
                <span className="ml-1 text-xs opacity-70">
                  ({assignment.verse_reference})
                </span>
              )}
            </p>

            {/* Mode badge + asset indicators */}
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  assignment.mode === 'bible'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                )}
              >
                {assignment.mode === 'bible' ? (
                  <BookOpen className="h-3 w-3" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {assignment.mode === 'bible' ? 'Bible' : 'Positivity'}
              </span>

              {assignment.has_camera_script && (
                <span title="Camera script">
                  <FileText className="h-3.5 w-3.5 text-text-muted dark:text-text-muted-dark" />
                </span>
              )}
              {assignment.has_lumashort_video && (
                <span title="Video recorded">
                  <Video className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                </span>
              )}
              {assignment.has_audio && (
                <span title="Audio available">
                  <Music className="h-3.5 w-3.5 text-text-muted dark:text-text-muted-dark" />
                </span>
              )}
              {assignment.has_srt && (
                <span title="Subtitles available">
                  <Subtitles className="h-3.5 w-3.5 text-text-muted dark:text-text-muted-dark" />
                </span>
              )}
            </div>

            {/* Upload progress bar (during upload) */}
            {isUploading && (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
                  {uploadProgress >= 70
                    ? 'Compressing & saving...'
                    : `Uploading... ${uploadProgress}%`}
                </p>
              </div>
            )}

            {/* Upload success message */}
            {justSucceeded && (
              <div className="mt-3 flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Submitted!</span>
              </div>
            )}

            {/* Upload Video button for assigned/rejected tiles */}
            {canRecord(assignment.status) && !isUploading && !justSucceeded && (
              <button
                type="button"
                onClick={(e) => handleUploadClick(e, assignment.id)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-text-dark dark:hover:bg-slate-700"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Video
              </button>
            )}
          </Wrapper>
        );
      })}
    </div>
  );
}
