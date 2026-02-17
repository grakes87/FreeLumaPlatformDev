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
 *   startCamera() -> startRecording() -> stopRecording() -> [preview / resetRecording() / submit]
 *   stopCamera() on unmount
 */
export function useMediaRecorder(): UseMediaRecorderResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

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

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: true,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera and microphone permissions.'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No camera found. Please connect a camera and try again.'
            : 'Failed to access camera. Please check permissions.';
      setError(message);
    }
  }, []);

  /**
   * Begin recording from the active stream.
   */
  const startRecording = useCallback(() => {
    if (!streamRef.current || !mimeType) {
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
    chunksRef.current = [];

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onerror = () => {
        setError('Recording error occurred');
        setIsRecording(false);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setIsRecording(false);
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    stream,
    isRecording,
    recordedBlob,
    recordedUrl,
    error,
    mimeType,
    startCamera,
    startRecording,
    stopRecording,
    resetRecording,
    stopCamera,
  };
}
