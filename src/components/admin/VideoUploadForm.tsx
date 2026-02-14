'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Upload, X, Film, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';

interface VideoCategory {
  id: number;
  name: string;
  slug: string;
}

interface VideoUploadFormProps {
  categories: VideoCategory[];
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Extract video duration client-side using HTMLVideoElement.
 */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration);
      URL.revokeObjectURL(video.src);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(0);
    };
    video.src = URL.createObjectURL(file);
  });
}

export function VideoUploadForm({
  categories,
  onSuccess,
  onCancel,
}: VideoUploadFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  type PublishMode = 'draft' | 'now' | 'schedule';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [publishMode, setPublishMode] = useState<PublishMode>('draft');
  const [scheduledDate, setScheduledDate] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Minimum datetime for the scheduler (now + 5 minutes, rounded)
  const minScheduleDate = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  }, []);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<
    'idle' | 'uploading' | 'saving' | 'processing' | 'done'
  >('idle');

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (!selected) return;

      // Validate file type
      const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
      if (!allowed.includes(selected.type)) {
        toast.error('Please select an MP4, WebM, or MOV video file');
        return;
      }

      // 2GB limit
      if (selected.size > 2 * 1024 * 1024 * 1024) {
        toast.error('Video file must be under 2GB');
        return;
      }

      setFile(selected);
    },
    [toast]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast.error('Please select a video file');
      return;
    }
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setUploading(true);
    setStep('uploading');
    setProgress(0);

    try {
      // Step 1: Get presigned URL
      const presignRes = await fetch(
        `/api/upload/presigned?type=video&contentType=${encodeURIComponent(file.type)}`,
        { credentials: 'include' }
      );
      if (!presignRes.ok) {
        const err = await presignRes.json();
        throw new Error(err.error || 'Failed to get upload URL');
      }
      const { uploadUrl, publicUrl } = await presignRes.json();

      // Step 2: Upload to B2 with progress via XMLHttpRequest
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            console.error('[VideoUpload] XHR status:', xhr.status, xhr.statusText, xhr.responseText);
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => {
          console.error('[VideoUpload] XHR network error — likely CORS or connectivity issue');
          reject(new Error('Upload failed — check browser console for CORS errors'));
        };
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.timeout = 0; // No timeout for large files
        xhr.send(file);
      });

      setStep('saving');

      // Step 3: Get duration client-side
      const durationSeconds = await getVideoDuration(file);

      // Step 4: Save video metadata
      const videoPayload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        category_id: categoryId || undefined,
        video_url: publicUrl,
        duration_seconds: durationSeconds,
        published: publishMode !== 'draft',
      };
      if (publishMode === 'schedule' && scheduledDate) {
        videoPayload.published_at = new Date(scheduledDate).toISOString();
      }

      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(videoPayload),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || 'Failed to save video');
      }

      const { video } = await createRes.json();

      // Step 5: Fire background processing (fire-and-forget)
      setStep('processing');
      fetch(`/api/videos/${video.id}/process`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {
        // Processing is best-effort
      });

      setStep('done');
      toast.success('Video uploaded successfully! Thumbnail will be generated in the background.');
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to upload video'
      );
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setProgress(0);
    setStep('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const stepLabel = {
    idle: '',
    uploading: 'Uploading video...',
    saving: 'Saving metadata...',
    processing: 'Starting background processing...',
    done: 'Complete!',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* ── Left column: File + Title + Description ── */}
        <div className="space-y-4">
          {/* Video file selection */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Video File
            </label>
            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-text-muted transition-colors hover:border-primary hover:text-primary dark:border-border-dark dark:text-text-muted-dark dark:hover:border-primary"
              >
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">
                  Click to select a video
                </span>
                <span className="text-xs">MP4, WebM, or MOV (max 2GB)</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-hover p-3 dark:border-border-dark dark:bg-surface-hover-dark">
                <Film className="h-8 w-8 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text dark:text-text-dark">
                    {file.name}
                  </p>
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    onClick={removeFile}
                    className="rounded-lg p-1 text-text-muted hover:text-red-500 dark:text-text-muted-dark"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Progress bar */}
          {uploading && step === 'uploading' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-text-muted dark:text-text-muted-dark">
                <span>{stepLabel[step]}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-hover dark:bg-surface-hover-dark">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Status indicator for non-upload steps */}
          {uploading && step !== 'uploading' && step !== 'idle' && (
            <div className="flex items-center gap-2 text-sm text-text-muted dark:text-text-muted-dark">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>{stepLabel[step]}</span>
            </div>
          )}

          {/* Title */}
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter video title"
            required
            disabled={uploading}
            maxLength={200}
          />

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter video description"
              disabled={uploading}
              rows={3}
              className={cn(
                'w-full rounded-xl border border-border bg-surface px-4 py-3 text-text transition-colors placeholder:text-text-muted',
                'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
                'resize-none disabled:cursor-not-allowed disabled:opacity-60'
              )}
            />
          </div>
        </div>

        {/* ── Right column: Category + Visibility ── */}
        <div className="space-y-4">
          {/* Category */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
              Category (optional)
            </label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setCategoryId(val ? parseInt(val, 10) : null);
              }}
              disabled={uploading}
              className={cn(
                'w-full rounded-xl border border-border bg-surface px-4 py-3 text-text transition-colors',
                'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark',
                'disabled:cursor-not-allowed disabled:opacity-60'
              )}
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Publish options */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text dark:text-text-dark">
              Visibility
            </label>
            {([
              { value: 'draft' as const, label: 'Draft', desc: 'Not visible to users' },
              { value: 'now' as const, label: 'Publish Now', desc: 'Visible immediately' },
              { value: 'schedule' as const, label: 'Schedule', desc: 'Publish at a specific time' },
            ]).map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
                  publishMode === opt.value
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-border bg-surface-hover dark:border-border-dark dark:bg-surface-hover-dark',
                  uploading && 'pointer-events-none opacity-60'
                )}
              >
                <input
                  type="radio"
                  name="publishMode"
                  value={opt.value}
                  checked={publishMode === opt.value}
                  onChange={() => setPublishMode(opt.value)}
                  disabled={uploading}
                  className="accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text dark:text-text-dark">
                    {opt.label}
                  </p>
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">
                    {opt.desc}
                  </p>
                </div>
              </label>
            ))}

            {/* Schedule date picker */}
            {publishMode === 'schedule' && (
              <div className="flex items-center gap-2 pl-8">
                <Calendar className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={minScheduleDate}
                  disabled={uploading}
                  required
                  className={cn(
                    'flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text',
                    'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                    'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark',
                    'disabled:cursor-not-allowed disabled:opacity-60'
                  )}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions — full width below the grid */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={uploading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={uploading}
          disabled={!file || !title.trim() || (publishMode === 'schedule' && !scheduledDate)}
          className="flex-1"
        >
          Upload Video
        </Button>
      </div>
    </form>
  );
}
