'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AlertCircle, Camera, ArrowLeft } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import type { DailyContentAttributes } from '@/lib/db/models/DailyContent';

// SSR-disabled imports for browser-only MediaRecorder APIs
const Teleprompter = dynamic(
  () => import('@/components/creator/Teleprompter').then((m) => ({ default: m.Teleprompter })),
  { ssr: false }
);
const RecordingControls = dynamic(
  () => import('@/components/creator/RecordingControls').then((m) => ({ default: m.RecordingControls })),
  { ssr: false }
);

type ContentData = Pick<
  DailyContentAttributes,
  'id' | 'post_date' | 'mode' | 'status' | 'title' | 'camera_script' | 'verse_reference' | 'content_text'
>;

export default function RecordPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? parseInt(params.id, 10) : NaN;

  const [content, setContent] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    stream,
    isRecording,
    isPaused,
    recordedBlob,
    recordedUrl,
    error: recorderError,
    mimeType,
    startCamera,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
    stopCamera,
  } = useMediaRecorder();

  // Fetch assignment content
  useEffect(() => {
    if (isNaN(id)) {
      setFetchError('Invalid assignment ID');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchContent() {
      try {
        const res = await fetch(`/api/creator/content/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load assignment');
        }
        const data = await res.json();
        if (!cancelled) {
          const c = data.content as DailyContentAttributes;
          // Verify status allows recording (assigned, rejected, or submitted for re-record)
          if (c.status !== 'assigned' && c.status !== 'rejected' && c.status !== 'submitted') {
            setFetchError(`Cannot record: content status is "${c.status}"`);
            setLoading(false);
            return;
          }
          setContent({
            id: c.id,
            post_date: c.post_date,
            mode: c.mode,
            status: c.status,
            title: c.title,
            camera_script: c.camera_script,
            verse_reference: c.verse_reference,
            content_text: c.content_text,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchContent();
    return () => { cancelled = true; };
  }, [id]);

  // Start camera when content is loaded
  useEffect(() => {
    if (content && !stream) {
      startCamera();
    }
  }, [content, stream, startCamera]);

  // Stream attachment is now handled inside the Teleprompter component itself
  // to avoid the race condition with dynamic imports on mobile.

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Submit recorded video:
   * Upload to server → server compresses with FFmpeg → uploads to B2.
   */
  const handleSubmit = useCallback(async () => {
    if (!recordedBlob || !content) return;

    setIsSubmitting(true);
    setUploadProgress(0);
    setSubmitError(null);

    try {
      // Build FormData with video file + content ID
      const formData = new FormData();
      const ext = (recordedBlob.type || mimeType || '').includes('mp4') ? 'mp4' : 'webm';
      formData.append('video', recordedBlob, `recording.${ext}`);
      formData.append('daily_content_id', String(content.id));

      // Upload to server with progress tracking via XHR.
      // Server handles compression + B2 upload before responding.
      const result = await new Promise<{ content: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/creator/upload', true);

        // Upload progress (0–70%)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 70);
            setUploadProgress(pct);
          }
        };

        // Once upload completes, server is compressing + uploading to B2
        xhr.upload.onload = () => {
          setUploadProgress(75);
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Invalid server response'));
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(data.error || `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Upload network error'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.timeout = 300000; // 5 min timeout (includes server-side compression)

        xhr.send(formData);
      });

      setUploadProgress(100);

      // Success - redirect to creator dashboard
      router.push('/creator');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
      setIsSubmitting(false);
    }
  }, [recordedBlob, content, mimeType, router]);

  const handleReRecord = useCallback(() => {
    resetRecording();
    setSubmitError(null);
  }, [resetRecording]);

  const handleBack = useCallback(() => {
    stopCamera();
    router.back();
  }, [stopCamera, router]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{fetchError}</p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!content) return null;

  // Build teleprompter script - camera_script if available, fallback to content_text
  const script = content.camera_script || content.content_text || '';

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Camera error state */}
      {recorderError && !stream && (
        <div className="flex h-full flex-col items-center justify-center px-6">
          <Camera className="h-16 w-16 text-white/40" />
          <p className="mt-4 text-center text-sm text-white/70">{recorderError}</p>
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 rounded-full bg-white/20 px-5 py-2 text-sm text-white/80 backdrop-blur-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={startCamera}
              className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Teleprompter (camera preview + fullscreen script overlay) */}
      {stream && (
        <Teleprompter
          script={script}
          videoRef={videoRef}
          stream={stream}
          isRecording={isRecording}
          isPaused={isPaused}
          onBack={handleBack}
        />
      )}

      {/* Recording controls */}
      {stream && (
        <RecordingControls
          isRecording={isRecording}
          isPaused={isPaused}
          recordedBlob={recordedBlob}
          recordedUrl={recordedUrl}
          onStartRecording={startRecording}
          onPauseRecording={pauseRecording}
          onResumeRecording={resumeRecording}
          onStopRecording={stopRecording}
          onReRecord={handleReRecord}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          uploadProgress={uploadProgress}
        />
      )}

      {/* Submit error toast */}
      {submitError && (
        <div className="absolute left-4 right-4 top-14 z-[60] rounded-xl border border-red-500/30 bg-red-900/80 px-4 py-3 text-sm text-red-200 backdrop-blur-sm">
          {submitError}
        </div>
      )}
    </div>
  );
}
