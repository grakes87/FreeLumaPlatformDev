'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/** Preferred MIME types in order of preference (mp4 for iOS/Safari, webm for Chrome/Firefox). */
const PREFERRED_MIME_TYPES = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export interface UseMediaRecorderResult {
  /** Live camera/mic stream (null until startCamera called) */
  stream: MediaStream | null;
  /** Whether actively recording */
  isRecording: boolean;
  /** Whether recording is paused */
  isPaused: boolean;
  /** Recorded video blob (null until recording stopped) */
  recordedBlob: Blob | null;
  /** Object URL for previewing recorded video (null until recording stopped) */
  recordedUrl: string | null;
  /** Error message if something failed */
  error: string | null;
  /** Detected MIME type for recordings */
  mimeType: string | undefined;
  /** Start front-facing camera + mic */
  startCamera: () => Promise<void>;
  /** Begin recording from the active stream */
  startRecording: () => void;
  /** Pause the active recording */
  pauseRecording: () => void;
  /** Resume a paused recording */
  resumeRecording: () => void;
  /** Stop recording and produce a blob */
  stopRecording: () => void;
  /** Clear recorded blob/URL but keep camera running */
  resetRecording: () => void;
  /** Stop all camera/mic tracks */
  stopCamera: () => void;
}

/**
 * Hook for capturing portrait video from the front-facing camera via MediaRecorder.
 *
 * Lifecycle:
 *   startCamera() -> startRecording() -> [pauseRecording() / resumeRecording()] -> stopRecording()
 *   -> [preview / resetRecording() / submit]
 *   stopCamera() on unmount
 */
export function useMediaRecorder(): UseMediaRecorderResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Canvas-based portrait correction for browsers that give landscape frames
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const canvasCleanupRef = useRef<(() => void) | null>(null);

  // Detect supported MIME type
  const mimeType =
    typeof MediaRecorder !== 'undefined'
      ? PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t))
      : undefined;

  /**
   * Start front-facing camera in portrait orientation (1080x1920) with audio.
   */
  const startCamera = useCallback(async () => {
    setError(null);

    if (streamRef.current) {
      // Already running
      return;
    }

    // getUserMedia requires HTTPS (secure context) on mobile browsers
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isInsecure = typeof window !== 'undefined' && window.isSecureContext === false;
      setError(
        isInsecure
          ? 'Camera requires HTTPS. Please access this site over a secure connection.'
          : 'Camera API not available on this browser.'
      );
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 },
        },
        audio: true,
      });

      // Check if camera gave landscape frames (common on Android Chrome).
      // If so, set up a canvas pipeline that center-crops to 9:16 portrait
      // so the MediaRecorder captures portrait video natively.
      const videoTrack = mediaStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const sw = settings.width ?? 0;
      const sh = settings.height ?? 0;

      if (sw > sh && sw > 0 && sh > 0) {
        try {
          // Calculate center-crop region: keep full height, crop width to 9:16
          const cropW = Math.round(sh * (9 / 16));
          const cropX = Math.round((sw - cropW) / 2);

          // Output canvas at 9:16 portrait dimensions
          const canvasW = Math.min(1080, cropW * 2);
          const canvasH = Math.round(canvasW * (16 / 9));

          const canvas = document.createElement('canvas');
          canvas.width = canvasW;
          canvas.height = canvasH;
          const ctx = canvas.getContext('2d')!;

          // Hidden video element to feed the canvas
          const sourceVideo = document.createElement('video');
          sourceVideo.srcObject = mediaStream;
          sourceVideo.muted = true;
          sourceVideo.playsInline = true;
          sourceVideo.setAttribute('playsinline', '');
          await sourceVideo.play();

          let active = true;
          const draw = () => {
            if (!active) return;
            // Center-crop from landscape source to portrait canvas
            ctx.drawImage(
              sourceVideo,
              cropX, 0, cropW, sh,     // source: center-cropped region
              0, 0, canvasW, canvasH   // dest: fill portrait canvas
            );
            // Use requestVideoFrameCallback for perfect sync if available
            if ('requestVideoFrameCallback' in sourceVideo) {
              (sourceVideo as any).requestVideoFrameCallback(draw);
            } else {
              requestAnimationFrame(draw);
            }
          };
          draw();

          // Portrait stream = canvas video + original audio
          const portraitStream = canvas.captureStream(30);
          mediaStream.getAudioTracks().forEach((t) => portraitStream.addTrack(t.clone()));
          recordingStreamRef.current = portraitStream;

          canvasCleanupRef.current = () => {
            active = false;
            sourceVideo.pause();
            sourceVideo.srcObject = null;
          };

          console.log(
            `[useMediaRecorder] Landscape detected (${sw}×${sh}), portrait crop pipeline active (${canvasW}×${canvasH})`
          );
        } catch (canvasErr) {
          console.warn('[useMediaRecorder] Portrait pipeline failed, using raw stream:', canvasErr);
        }
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera and microphone permissions in your browser settings.'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No camera found. Please connect a camera and try again.'
            : err instanceof DOMException && err.name === 'NotReadableError'
              ? 'Camera is in use by another app. Please close other apps using the camera.'
              : `Failed to access camera: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(message);
    }
  }, []);

  /**
   * Begin recording from the active stream.
   */
  const startRecording = useCallback(() => {
    // Use portrait-corrected stream if available, otherwise raw camera stream
    const recordStream = recordingStreamRef.current || streamRef.current;
    if (!recordStream || !mimeType) {
      setError('Camera not started or recording not supported');
      return;
    }

    // Clear any previous recording
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      setRecordedBlob(null);
    }

    setError(null);
    setIsPaused(false);
    chunksRef.current = [];

    try {
      const recorder = new MediaRecorder(recordStream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onerror = () => {
        setError('Recording error occurred');
        setIsRecording(false);
        setIsPaused(false);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setIsRecording(false);
        setIsPaused(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100); // collect chunks every 100ms
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording');
      console.error('[useMediaRecorder] start error:', err);
    }
  }, [mimeType, recordedUrl]);

  /**
   * Pause the active recording.
   */
  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.pause();
      setIsPaused(true);
    }
  }, []);

  /**
   * Resume a paused recording.
   */
  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'paused') {
      recorder.resume();
      setIsPaused(false);
    }
  }, []);

  /**
   * Stop the active recording. Triggers onstop which sets blob/url.
   */
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  /**
   * Clear recorded blob/URL but keep the camera running for re-recording.
   */
  const resetRecording = useCallback(() => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setError(null);
    setIsPaused(false);
    chunksRef.current = [];
    mediaRecorderRef.current = null;
  }, [recordedUrl]);

  /**
   * Stop all camera/mic tracks and clean up.
   */
  const stopCamera = useCallback(() => {
    // Stop any active recording
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }

    // Clean up canvas portrait pipeline
    canvasCleanupRef.current?.();
    canvasCleanupRef.current = null;
    recordingStreamRef.current = null;

    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }

    // Revoke object URL
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }

    setIsRecording(false);
    setIsPaused(false);
    setRecordedBlob(null);
    setRecordedUrl(null);
    chunksRef.current = [];
    mediaRecorderRef.current = null;
  }, [recordedUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      canvasCleanupRef.current?.();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    stream,
    isRecording,
    isPaused,
    recordedBlob,
    recordedUrl,
    error,
    mimeType,
    startCamera,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
    stopCamera,
  };
}
