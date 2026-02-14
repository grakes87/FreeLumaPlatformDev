'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Send, Mic, Square, Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useVoiceRecorder, MAX_VOICE_DURATION_S } from '@/hooks/useVoiceRecorder';

interface VoiceRecorderProps {
  /** Called with uploaded voice URL + duration to create the message via useChat */
  onSendVoice: (media: { media_url: string; media_type: 'voice'; duration: number }) => void;
  /** Called when recording is cancelled or finished */
  onClose: () => void;
}

/** Number of waveform bars to display */
const BAR_COUNT = 20;

/** Minimum bar height as fraction */
const MIN_BAR_HEIGHT = 0.1;

type RecorderPhase = 'recording' | 'stopped' | 'uploading';

/**
 * Voice message recording UI with:
 * - Recording phase: live waveform + timer + stop button
 * - Stopped phase: playback preview + re-record + send
 * - Upload phase: uploading spinner
 */
export function VoiceRecorder({ onSendVoice, onClose }: VoiceRecorderProps) {
  const {
    isRecording,
    duration,
    audioLevel,
    isSupported,
    mimeType,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder();

  const [phase, setPhase] = useState<RecorderPhase>('recording');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Playback preview state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Waveform history for stopped preview
  const [waveformSnapshot, setWaveformSnapshot] = useState<number[]>([]);
  const waveformHistory = useRef<number[]>([]);

  // Record audio levels for waveform snapshot
  useEffect(() => {
    if (isRecording) {
      waveformHistory.current.push(audioLevel);
      // Keep last 200 samples
      if (waveformHistory.current.length > 200) {
        waveformHistory.current.shift();
      }
    }
  }, [audioLevel, isRecording]);

  // Auto-start recording on mount
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        setError(null);
        await startRecording();
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Microphone access denied. Please allow microphone access.'
            : 'Could not start recording.';
        setError(msg);
      }
    })();
  }, [startRecording]);

  // Stop recording and go to preview
  const handleStop = useCallback(async () => {
    const finalDuration = duration;
    const blob = await stopRecording();
    if (blob) {
      setRecordedBlob(blob);
      setRecordedDuration(finalDuration);
      setPhase('stopped');

      // Create snapshot of waveform for display
      const history = waveformHistory.current;
      const snapshot: number[] = [];
      const step = Math.max(1, Math.floor(history.length / BAR_COUNT));
      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.min(i * step, history.length - 1);
        snapshot.push(history[idx] ?? MIN_BAR_HEIGHT);
      }
      setWaveformSnapshot(snapshot);

      // Prepare audio element for preview
      // Use a data URL to avoid blob range-request errors on some browsers
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        audioUrlRef.current = dataUrl;
        const audio = new Audio(dataUrl);
        audio.preload = 'auto';
        audio.onended = () => {
          setIsPlaying(false);
          setPlaybackTime(0);
          clearInterval(playbackTimerRef.current);
        };
        audioRef.current = audio;
      };
      reader.readAsDataURL(blob);
    }
  }, [duration, stopRecording]);

  // Auto-stop at max duration → transition to preview phase
  const handleStopRef = useRef(handleStop);
  handleStopRef.current = handleStop;
  useEffect(() => {
    if (phase === 'recording' && isRecording && duration >= MAX_VOICE_DURATION_S) {
      handleStopRef.current();
    }
  }, [duration, isRecording, phase]);

  // Cancel and close
  const handleCancel = useCallback(() => {
    cancelRecording();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (audioRef.current) audioRef.current.pause();
    clearInterval(playbackTimerRef.current);
    onClose();
  }, [cancelRecording, onClose]);

  // Toggle playback preview
  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      clearInterval(playbackTimerRef.current);
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
      playbackTimerRef.current = setInterval(() => {
        setPlaybackTime(Math.floor(audio.currentTime));
      }, 250);
    }
  }, [isPlaying]);

  // Re-record: discard current and start fresh
  const handleReRecord = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    clearInterval(playbackTimerRef.current);
    setRecordedBlob(null);
    setRecordedDuration(0);
    setIsPlaying(false);
    setPlaybackTime(0);
    waveformHistory.current = [];
    setWaveformSnapshot([]);

    try {
      setError(null);
      await startRecording();
      setPhase('recording');
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied.'
          : 'Could not start recording.'
      );
    }
  }, [startRecording]);

  // Upload and send
  const handleSend = useCallback(async () => {
    if (!recordedBlob) return;
    setPhase('uploading');
    setError(null);

    // Stop playback
    if (audioRef.current) audioRef.current.pause();
    clearInterval(playbackTimerRef.current);

    try {
      const contentType = mimeType || 'audio/webm';

      const presignRes = await fetch(
        `/api/upload/chat-media?contentType=${encodeURIComponent(contentType)}`
      );
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get upload URL');
      }
      const { upload_url, public_url } = await presignRes.json();

      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: recordedBlob,
      });
      if (!uploadRes.ok) {
        throw new Error('Failed to upload voice message');
      }

      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);

      onSendVoice({
        media_url: public_url,
        media_type: 'voice',
        duration: recordedDuration,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send voice message');
      setPhase('stopped');
    }
  }, [recordedBlob, mimeType, recordedDuration, onSendVoice, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (audioRef.current) audioRef.current.pause();
      clearInterval(playbackTimerRef.current);
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-400">
        <Mic className="h-4 w-4 shrink-0" />
        <span>Voice recording is not supported in this browser.</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-red-300 hover:text-red-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // --- Recording phase ---
  if (phase === 'recording') {
    return (
      <div className="flex items-center gap-2 px-3 py-2" role="region" aria-label="Recording voice message">
        {/* Cancel */}
        <button
          type="button"
          onClick={handleCancel}
          className="shrink-0 rounded-full p-2 text-red-400 transition-colors hover:bg-red-500/10"
          aria-label="Cancel recording"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Live waveform */}
        <div className="flex flex-1 items-center justify-center gap-[2px] h-10" aria-hidden="true">
          {Array.from({ length: BAR_COUNT }).map((_, i) => {
            const centerWeight = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
            const barLevel = isRecording
              ? MIN_BAR_HEIGHT + audioLevel * (0.5 + 0.5 * centerWeight)
              : MIN_BAR_HEIGHT;
            const height = Math.min(1, barLevel) * 32 + 3;

            return (
              <div
                key={i}
                className="w-[2.5px] rounded-full bg-red-400 transition-all duration-100"
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>

        {/* Recording dot + timer */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span
            className={cn(
              'min-w-[2.5rem] font-mono text-xs tabular-nums',
              duration >= MAX_VOICE_DURATION_S - 10 ? 'text-red-500 font-semibold' : 'text-red-400'
            )}
          >
            {formatTime(duration)}
          </span>
        </div>

        {/* Stop button */}
        <button
          type="button"
          onClick={handleStop}
          className={cn(
            'shrink-0 flex h-9 w-9 items-center justify-center rounded-full',
            'bg-red-500 text-white transition-all active:scale-90'
          )}
          aria-label="Stop recording"
        >
          <Square className="h-4 w-4" fill="currentColor" />
        </button>

        {error && (
          <div className="absolute -bottom-7 left-0 right-0 text-center text-xs text-red-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  // --- Stopped / Preview phase ---
  if (phase === 'stopped') {
    return (
      <div className="flex items-center gap-2 px-3 py-2" role="region" aria-label="Voice message preview">
        {/* Re-record */}
        <button
          type="button"
          onClick={handleReRecord}
          className="shrink-0 rounded-full p-2 text-gray-500 dark:text-gray-400 transition-colors hover:text-red-400"
          aria-label="Re-record"
        >
          <RotateCcw className="h-5 w-5" />
        </button>

        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlayback}
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
          aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
          )}
        </button>

        {/* Static waveform + time */}
        <div className="flex flex-1 items-center gap-2">
          <div className="flex flex-1 items-center justify-center gap-[2px] h-8" aria-hidden="true">
            {waveformSnapshot.map((level, i) => {
              const height = Math.min(1, Math.max(MIN_BAR_HEIGHT, level)) * 28 + 3;
              const played = recordedDuration > 0 && (i / BAR_COUNT) <= (playbackTime / recordedDuration);
              return (
                <div
                  key={i}
                  className={cn(
                    'w-[2.5px] rounded-full transition-colors duration-150',
                    played ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                  )}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
          <span className="min-w-[2.5rem] font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {isPlaying ? formatTime(playbackTime) : formatTime(recordedDuration)}
          </span>
        </div>

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          className={cn(
            'shrink-0 rounded-full bg-primary p-2 text-white transition-all',
            'active:scale-90 hover:bg-primary/90'
          )}
          aria-label="Send voice message"
        >
          <Send className="h-5 w-5" />
        </button>

        {error && (
          <div className="absolute -bottom-7 left-0 right-0 text-center text-xs text-red-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  // --- Uploading phase ---
  return (
    <div className="flex items-center justify-center gap-2 px-3 py-3" role="region" aria-label="Sending voice message">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      <span className="text-sm text-gray-500 dark:text-gray-400">Sending...</span>
    </div>
  );
}
