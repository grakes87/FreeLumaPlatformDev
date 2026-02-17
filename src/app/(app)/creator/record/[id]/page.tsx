'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, AlertCircle, Camera } from 'lucide-react';
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
    recordedBlob,
    recordedUrl,
    error: recorderError,
    mimeType,
    startCamera,
    startRecording,
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
          // Verify status allows recording
          if (c.status !== 'assigned' && c.status !== 'rejected') {
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

  // Attach stream to video element for preview
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Submit recorded video:
   * 1. Get presigned URL from /api/upload/presigned
   * 2. PUT video blob to B2
   * 3. POST /api/creator/upload to update content record
   */
  const handleSubmit = useCallback(async () => {
    if (!recordedBlob || !content) return;

    setIsSubmitting(true);
    setUploadProgress(0);
    setSubmitError(null);

    try {
      // Determine content type from blob or mimeType
      const videoContentType = recordedBlob.type || mimeType || 'video/webm';

      // Step 1: Get presigned upload URL
      const presignRes = await fetch(
        `/api/upload/presigned?type=creator-video&contentType=${encodeURIComponent(videoContentType)}`
      );
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get upload URL');
      }
      const { uploadUrl, publicUrl } = await presignRes.json();

      setUploadProgress(10);

      // Step 2: Upload video to B2 via presigned PUT
      // Use XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', videoContentType);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            // Scale progress from 10-90% for upload phase
            const pct = Math.round(10 + (e.loaded / e.total) * 80);
            setUploadProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload network error'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.timeout = 120000; // 2 minute timeout

        xhr.send(recordedBlob);
      });

      setUploadProgress(90);

      // Step 3: Notify backend that video was uploaded
      const submitRes = await fetch('/api/creator/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_content_id: content.id,
          video_url: publicUrl,
        }),
      });

      if (!submitRes.ok) {
        const data = await submitRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit video');
      }

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
      {/* Back button - always visible above everything */}
      <button
        type="button"
        onClick={handleBack}
        className="absolute left-3 top-3 z-[60] flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Camera error state */}
      {recorderError && !stream && (
        <div className="flex h-full flex-col items-center justify-center px-6">
          <Camera className="h-16 w-16 text-white/40" />
          <p className="mt-4 text-center text-sm text-white/70">{recorderError}</p>
          <button
            type="button"
            onClick={startCamera}
            className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Teleprompter (camera preview + script overlay) */}
      {stream && (
        <Teleprompter
          script={script}
          videoRef={videoRef}
          isRecording={isRecording}
        />
      )}

      {/* Recording controls */}
      {stream && (
        <RecordingControls
          isRecording={isRecording}
          recordedBlob={recordedBlob}
          recordedUrl={recordedUrl}
          onStartRecording={startRecording}
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
