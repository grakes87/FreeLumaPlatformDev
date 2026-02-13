'use client';

import { useState, useCallback } from 'react';
import { X, Send, Mic } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

interface VoiceRecorderProps {
  /** Conversation ID to send voice message to */
  conversationId: string;
  /** Called after voice message is successfully sent */
  onSent?: () => void;
  /** Called when recording is cancelled or finished */
  onClose: () => void;
}

/** Number of waveform bars to display */
const BAR_COUNT = 8;

/** Minimum bar height as fraction (bars never fully disappear) */
const MIN_BAR_HEIGHT = 0.15;

/**
 * Voice message recording UI with live waveform visualization.
 *
 * Layout: [Cancel X] [Waveform bars] [MM:SS timer] [Send]
 *
 * - Waveform bars scale with audioLevel from AnalyserNode
 * - Cancel discards recording
 * - Send stops recording, uploads blob to B2 via presigned URL,
 *   then creates a voice message via the chat API
 */
export function VoiceRecorder({
  conversationId,
  onSent,
  onClose,
}: VoiceRecorderProps) {
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

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-start recording on mount
  const handleStart = useCallback(async () => {
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
  }, [startRecording]);

  // Start recording when component mounts (user tapped mic)
  // We use a ref check to only start once
  const startedRef = useState(() => {
    // Trigger start after first render
    if (typeof window !== 'undefined') {
      setTimeout(() => handleStart(), 0);
    }
    return true;
  });
  // Suppress unused warning
  void startedRef;

  const handleCancel = useCallback(() => {
    cancelRecording();
    onClose();
  }, [cancelRecording, onClose]);

  const handleSend = useCallback(async () => {
    if (isSending) return;
    setIsSending(true);
    setError(null);

    try {
      const blob = await stopRecording();
      if (!blob) {
        setError('No audio recorded.');
        setIsSending(false);
        return;
      }

      // Determine content type for upload
      const contentType = mimeType || 'audio/webm';

      // 1. Get presigned URL from chat-media API
      const presignRes = await fetch(
        `/api/upload/chat-media?contentType=${encodeURIComponent(contentType)}`
      );
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get upload URL');
      }
      const { upload_url, public_url } = await presignRes.json();

      // 2. PUT blob to presigned URL
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });
      if (!uploadRes.ok) {
        throw new Error('Failed to upload voice message');
      }

      // 3. Send message via chat API
      const msgRes = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'voice',
            media: [
              {
                url: public_url,
                type: 'voice',
                mime_type: contentType,
                duration,
              },
            ],
          }),
        }
      );
      if (!msgRes.ok) {
        const data = await msgRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send voice message');
      }

      onSent?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send voice message');
      setIsSending(false);
    }
  }, [isSending, stopRecording, mimeType, conversationId, duration, onSent, onClose]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
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

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl px-4 py-3',
        'bg-red-500/10 dark:bg-red-500/15',
        'animate-in slide-in-from-bottom-2 duration-200'
      )}
      role="region"
      aria-label="Voice recorder"
    >
      {/* Recording indicator dot */}
      {isRecording && (
        <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
      )}

      {/* Cancel button */}
      <button
        type="button"
        onClick={handleCancel}
        disabled={isSending}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          'bg-red-500/20 text-red-400 transition-colors',
          'hover:bg-red-500/30 active:scale-95',
          'disabled:opacity-50'
        )}
        aria-label="Cancel recording"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Waveform visualization */}
      <div className="flex flex-1 items-center justify-center gap-[3px]" aria-hidden="true">
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          // Create natural-looking waveform: center bars taller, edges shorter
          const centerWeight = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
          const barLevel = isRecording
            ? MIN_BAR_HEIGHT + audioLevel * (0.6 + 0.4 * centerWeight)
            : MIN_BAR_HEIGHT;
          const height = Math.min(1, barLevel) * 28 + 4; // 4px min, 32px max

          return (
            <div
              key={i}
              className="w-[3px] rounded-full bg-red-400 transition-all duration-75"
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>

      {/* Timer */}
      <span
        className={cn(
          'min-w-[3rem] text-center font-mono text-sm tabular-nums',
          'text-red-400 dark:text-red-300'
        )}
      >
        {formatTime(duration)}
      </span>

      {/* Send button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={isSending || !isRecording}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          'bg-blue-500 text-white transition-colors',
          'hover:bg-blue-600 active:scale-95',
          'disabled:opacity-50'
        )}
        aria-label={isSending ? 'Sending voice message' : 'Send voice message'}
      >
        {isSending ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </button>

      {/* Error message */}
      {error && (
        <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
