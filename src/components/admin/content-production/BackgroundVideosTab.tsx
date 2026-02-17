'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Upload,
  Video,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { DayData } from './DayCard';

interface BackgroundVideosTabProps {
  days: DayData[];
  month: string;
  onRefresh: () => void;
}

interface UploadResult {
  filename: string;
  date: string;
  status: 'success' | 'error' | 'uploading' | 'pending';
  error?: string;
  progress?: number;
}

/** Validates filename matches YYYY-MM-DD-background.mp4 convention */
function parseBackgroundFilename(filename: string): string | null {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})-background\.mp4$/i);
  return match ? match[1] : null;
}

export function BackgroundVideosTab({ days, month, onRefresh }: BackgroundVideosTabProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);

  // Build a set of dates that already have background videos
  // We check the DayData -- if the API provides video_background_url info, it's not
  // directly in DayData but we can infer from the data. For now, track via upload results.
  const daysWithVideo = useMemo(() => {
    const set = new Set<string>();
    // Note: The API month overview doesn't expose video_background_url directly,
    // but the BackgroundVideos tab is mainly for uploading new ones.
    // We rely on a fresh fetch after uploads complete.
    return set;
  }, []);

  const handleFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const results: UploadResult[] = [];
      const validFiles: { file: File; date: string; idx: number }[] = [];

      // Validate filenames
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const date = parseBackgroundFilename(file.name);
        if (!date) {
          results.push({
            filename: file.name,
            date: '',
            status: 'error',
            error: `Invalid filename. Expected YYYY-MM-DD-background.mp4`,
          });
        } else if (!date.startsWith(month)) {
          results.push({
            filename: file.name,
            date,
            status: 'error',
            error: `Date ${date} does not match selected month ${month}`,
          });
        } else {
          results.push({
            filename: file.name,
            date,
            status: 'pending',
          });
          validFiles.push({ file, date, idx: results.length - 1 });
        }
      }

      setUploads(results);

      if (validFiles.length === 0) {
        toast.error('No valid files to upload');
        return;
      }

      setUploading(true);

      // Upload each file: get presigned URL, upload to B2, then link via API
      const uploadEntries: { date: string; video_url: string }[] = [];

      for (const { file, date, idx } of validFiles) {
        try {
          // Update status to uploading
          setUploads((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], status: 'uploading', progress: 0 };
            return next;
          });

          // Get presigned URL
          const presignRes = await fetch(
            `/api/upload/presigned?type=daily-content&contentType=${encodeURIComponent(file.type)}`,
            { credentials: 'include' }
          );
          if (!presignRes.ok) {
            throw new Error('Failed to get upload URL');
          }
          const { uploadUrl, publicUrl } = await presignRes.json();

          // Upload to B2
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
          });
          if (!uploadRes.ok) {
            throw new Error('Upload to storage failed');
          }

          uploadEntries.push({ date, video_url: publicUrl });

          setUploads((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], status: 'success', progress: 100 };
            return next;
          });
        } catch (err) {
          setUploads((prev) => {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              status: 'error',
              error: err instanceof Error ? err.message : 'Upload failed',
            };
            return next;
          });
        }
      }

      // Link uploaded videos to daily content records
      if (uploadEntries.length > 0) {
        try {
          const res = await fetch('/api/admin/content-production/background-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ uploads: uploadEntries }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to link videos');

          const notFound = data.not_found || [];
          if (notFound.length > 0) {
            toast.warning(
              `${data.updated} videos linked. ${notFound.length} dates not found: ${notFound.join(', ')}`
            );
          } else {
            toast.success(`${data.updated} background videos linked successfully`);
          }
          onRefresh();
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to link videos'
          );
        }
      }

      setUploading(false);
    },
    [month, onRefresh, toast]
  );

  // Build calendar grid for the month
  const calendarDays = useMemo(() => {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    const grid: { date: string; dayNum: number; hasDay: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      const hasDay = days.some((day) => day.post_date === dateStr);
      grid.push({ date: dateStr, dayNum: d, hasDay });
    }
    return grid;
  }, [month, days]);

  // Track which dates had successful uploads
  const uploadedDates = useMemo(
    () => new Set(uploads.filter((u) => u.status === 'success').map((u) => u.date)),
    [uploads]
  );

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="rounded-xl border-2 border-dashed border-border bg-surface/50 p-6 text-center dark:border-border-dark dark:bg-surface-dark/50">
        <Video className="mx-auto h-10 w-10 text-text-muted dark:text-text-muted-dark" />
        <p className="mt-3 text-sm font-medium text-text dark:text-text-dark">
          Upload Background Videos
        </p>
        <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
          Filename format: <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-700">YYYY-MM-DD-background.mp4</code>
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,video/mp4"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        <Button
          size="sm"
          className="mt-4"
          onClick={() => fileInputRef.current?.click()}
          loading={uploading}
        >
          <Upload className="h-4 w-4" /> Select .mp4 Files
        </Button>
      </div>

      {/* Upload Results */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-text dark:text-text-dark">
            Upload Results
          </h4>
          {uploads.map((u, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
                u.status === 'success' && 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
                u.status === 'error' && 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
                u.status === 'uploading' && 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
                u.status === 'pending' && 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark'
              )}
            >
              {u.status === 'success' && <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />}
              {u.status === 'error' && <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
              {u.status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />}
              {u.status === 'pending' && <AlertTriangle className="h-4 w-4 shrink-0 text-slate-400" />}
              <span className="font-mono text-xs">{u.filename}</span>
              {u.error && (
                <span className="ml-auto text-xs text-red-600 dark:text-red-400">
                  {u.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Calendar Grid */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-text dark:text-text-dark">
          Background Video Status
        </h4>
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-text-muted dark:text-text-muted-dark">
              {d}
            </div>
          ))}

          {/* Leading empty cells */}
          {(() => {
            const [yearStr, monthStr] = month.split('-');
            const firstDay = new Date(
              parseInt(yearStr, 10),
              parseInt(monthStr, 10) - 1,
              1
            ).getDay();
            return Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} />
            ));
          })()}

          {calendarDays.map(({ date, dayNum, hasDay }) => {
            const wasUploaded = uploadedDates.has(date);
            return (
              <div
                key={date}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border p-2 text-xs',
                  !hasDay && 'border-dashed border-border/50 text-text-muted/50 dark:border-border-dark/50',
                  hasDay && !wasUploaded && 'border-border bg-surface text-text dark:border-border-dark dark:bg-surface-dark dark:text-text-dark',
                  wasUploaded && 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400'
                )}
              >
                <span className="font-medium">{dayNum}</span>
                {wasUploaded && <Video className="mt-0.5 h-3 w-3" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
