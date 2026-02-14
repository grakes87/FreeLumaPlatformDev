'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

export const MAX_VOICE_DURATION_S = 120; // 2 minutes

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=aac',
  'audio/webm',
];

export interface VoiceRecorderResult {
  isRecording: boolean;
  duration: number;
  /** Audio level 0-1, updated ~15fps via ref polling */
  audioLevel: number;
  isSupported: boolean;
  mimeType: string | undefined;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

/**
 * Hook for recording voice messages with live audio level metering.
 *
 * Key design decisions:
 * - Audio level is measured via AnalyserNode (time-domain RMS)
 * - The analyser runs in a rAF loop writing to a REF (not state)
 * - A 66ms interval polls the ref → state (≈15fps, avoids flooding React)
 * - Audio graph: source → analyser → silent gain → destination
 *   (ensures the graph is processed even on Safari)
 */
export function useVoiceRecorder(): VoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const levelPollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startTimeRef = useRef(0);
  const stoppedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Live audio level stored in ref, polled to state at ~15fps
  const levelRef = useRef(0);

  const mimeType =
    typeof MediaRecorder !== 'undefined'
      ? PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t))
      : undefined;

  /** Stop analysis (AudioContext, rAF, timers) but keep the mic stream alive */
  const cleanupAnalysis = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    clearInterval(durationTimerRef.current);
    clearInterval(levelPollRef.current);

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  /** Release the mic stream (call on cancel / unmount) */
  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      stoppedRef.current = true;

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        resolve(blob);
      };

      recorder.stop();
      // Only stop analysis — keep the mic stream alive for fast re-record
      cleanupAnalysis();
      setIsRecording(false);
      setAudioLevel(0);
      levelRef.current = 0;
    });
  }, [mimeType, cleanupAnalysis]);

  const startRecording = useCallback(async () => {
    if (!mimeType) throw new Error('Voice recording not supported');

    stoppedRef.current = false;

    // 1. Reuse existing mic stream if available, otherwise request new one
    let stream = streamRef.current;
    if (!stream || stream.getTracks().every((t) => t.readyState === 'ended')) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    }

    // 2. Set up Web Audio graph: source → analyser → silent gain → destination
    //    Connecting to destination (even silently) ensures the graph is processed.
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;

    const silentGain = ctx.createGain();
    silentGain.gain.value = 0; // mute output — we only need analysis

    source.connect(analyser);
    analyser.connect(silentGain);
    silentGain.connect(ctx.destination);

    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    // 3. rAF loop: compute RMS from time-domain data → write to levelRef
    const buf = new Uint8Array(analyser.fftSize);
    const updateLevel = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(buf);

      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128; // normalize to -1..1
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      // Scale: normal speech ≈ 0.05-0.2 RMS → we want 0.3-0.9 visual
      levelRef.current = Math.min(1, rms * 5);
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();

    // 4. Poll levelRef → state at ~15fps (avoids flooding React at 60fps)
    levelPollRef.current = setInterval(() => {
      setAudioLevel(levelRef.current);
    }, 66);

    // 5. Start MediaRecorder
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorderRef.current = recorder;
    recorder.start(100);

    startTimeRef.current = Date.now();
    setIsRecording(true);
    setDuration(0);

    // 6. Duration timer (auto-stop is handled by the consuming component)
    durationTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);
    }, 1000);
  }, [mimeType]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    cleanupAnalysis();
    releaseStream();
    chunksRef.current = [];
    setIsRecording(false);
    setDuration(0);
    setAudioLevel(0);
    levelRef.current = 0;
  }, [cleanupAnalysis, releaseStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      clearInterval(durationTimerRef.current);
      clearInterval(levelPollRef.current);

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
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
