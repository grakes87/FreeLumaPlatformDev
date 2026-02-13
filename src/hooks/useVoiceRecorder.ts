'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

const MAX_DURATION_MS = 60_000; // 60 seconds

/**
 * Preferred MIME types in order of codec quality/support.
 * WebM/Opus is ideal (Chrome, Firefox, Safari 18.4+).
 * MP4/AAC is fallback for older Safari.
 * Plain WebM as last resort.
 */
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=aac',
  'audio/webm',
];

export interface VoiceRecorderResult {
  /** Whether actively recording */
  isRecording: boolean;
  /** Elapsed recording time in seconds */
  duration: number;
  /** Audio level 0-1 for waveform visualization */
  audioLevel: number;
  /** Whether MediaRecorder is available in this browser */
  isSupported: boolean;
  /** The detected MIME type that will be used for recording */
  mimeType: string | undefined;
  /** Begin recording. Requests microphone permission. */
  startRecording: () => Promise<void>;
  /** Stop recording and return the audio Blob (or null if nothing recorded) */
  stopRecording: () => Promise<Blob | null>;
  /** Cancel recording and discard all audio data */
  cancelRecording: () => void;
}

/**
 * Hook for recording voice messages using the native MediaRecorder API
 * with live waveform visualization via AnalyserNode.
 *
 * - MIME type detection with cross-browser fallback
 * - Chunks collected every 100ms
 * - Duration tracking (1s intervals)
 * - Audio level (0-1) from AnalyserNode for waveform bars
 * - Auto-stop at 60 seconds
 * - Full cleanup on unmount
 */
export function useVoiceRecorder(): VoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const animFrame = useRef<number>(0);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startTime = useRef(0);
  const stoppedRef = useRef(false);

  // Detect supported MIME type (runs once, safe in SSR because of typeof guard)
  const mimeType =
    typeof MediaRecorder !== 'undefined'
      ? PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t))
      : undefined;

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrame.current);
    if (audioContext.current && audioContext.current.state !== 'closed') {
      audioContext.current.close().catch(() => {});
    }
    audioContext.current = null;
    analyser.current = null;
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (
        !mediaRecorder.current ||
        mediaRecorder.current.state === 'inactive'
      ) {
        resolve(null);
        return;
      }

      stoppedRef.current = true;

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: mimeType });
        resolve(blob);
      };

      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach((t) => t.stop());
      cleanup();
      setIsRecording(false);
      setAudioLevel(0);
    });
  }, [mimeType, cleanup]);

  const startRecording = useCallback(async () => {
    if (!mimeType) throw new Error('Voice recording not supported in this browser');

    stoppedRef.current = false;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Set up AnalyserNode for live waveform
    audioContext.current = new AudioContext();
    const source = audioContext.current.createMediaStreamSource(stream);
    analyser.current = audioContext.current.createAnalyser();
    analyser.current.fftSize = 256;
    source.connect(analyser.current);

    // Animate audio level from frequency data
    const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
    const updateLevel = () => {
      if (!analyser.current) return;
      analyser.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(avg / 255);
      animFrame.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();

    // Start MediaRecorder
    const recorder = new MediaRecorder(stream, { mimeType });
    chunks.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    mediaRecorder.current = recorder;
    recorder.start(100); // collect data every 100ms

    startTime.current = Date.now();
    setIsRecording(true);
    setDuration(0);

    // Duration timer + auto-stop at 60s
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
      setDuration(elapsed);
      if (elapsed * 1000 >= MAX_DURATION_MS && !stoppedRef.current) {
        stopRecording();
      }
    }, 1000);
  }, [mimeType, stopRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach((t) => t.stop());
    }
    cleanup();
    chunks.current = [];
    setIsRecording(false);
    setDuration(0);
    setAudioLevel(0);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrame.current);
      clearInterval(timerRef.current);
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
        mediaRecorder.current.stream.getTracks().forEach((t) => t.stop());
      }
      if (audioContext.current && audioContext.current.state !== 'closed') {
        audioContext.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    isRecording,
    duration,
    audioLevel,
    isSupported: !!mimeType,
    mimeType,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
