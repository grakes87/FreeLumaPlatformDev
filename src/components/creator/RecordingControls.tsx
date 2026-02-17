'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { RotateCcw, Send, Square } from 'lucide-react';

interface RecordingControlsProps {
  /** Whether actively recording */
  isRecording: boolean;
  /** Blob from completed recording */
  recordedBlob: Blob | null;
  /** Object URL for preview playback */
  recordedUrl: string | null;
  /** Start recording callback */
  onStartRecording: () => void;
  /** Stop recording callback */
  onStopRecording: () => void;
  /** Reset and re-record callback */
  onReRecord: () => void;
  /** Submit the recorded video */
  onSubmit: () => void;
  /** Whether submission is in progress */
  isSubmitting: boolean;
  /** Upload progress 0-100 (optional) */
  uploadProgress?: number;
}

/**
 * Recording controls overlay shown at the bottom of the teleprompter view.
 *
 * States:
 * - Pre-recording: large red Record button
 * - Recording: white Stop button with elapsed duration
 * - Post-recording: video preview + Re-record + Submit buttons
 * - Submitting: progress bar + disabled buttons
 */
export function RecordingControls({
  isRecording,
  recordedBlob,
  recordedUrl,
  onStartRecording,
  onStopRecording,
  onReRecord,
  onSubmit,
  isSubmitting,
  uploadProgress,
}: RecordingControlsProps) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startRef = useRef(0);

  // Elapsed timer while recording
  useEffect(() => {
    if (isRecording) {
      startRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Post-recording: preview + controls
  if (recordedBlob && recordedUrl && !isRecording) {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent pb-8 pt-16">
        {/* Preview video */}
        <div className="mx-auto mb-4 w-48 overflow-hidden rounded-xl border-2 border-white/30">
          <video
            src={recordedUrl}
            className="aspect-[9/16] w-full object-cover"
            controls
            playsInline
          />
        </div>

        {/* Submitting progress bar */}
        {isSubmitting && (
          <div className="mx-auto mb-4 w-64">
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress ?? 0}%` }}
              />
            </div>
            <p className="mt-1 text-center text-xs text-white/70">
              Uploading... {uploadProgress ?? 0}%
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={onReRecord}
            disabled={isSubmitting}
            className={cn(
              'flex items-center gap-2 rounded-full bg-white/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all',
              isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/30 active:scale-95'
            )}
          >
            <RotateCcw className="h-4 w-4" />
            Re-record
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className={cn(
              'flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-all',
              isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-dark active:scale-95'
            )}
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    );
  }

  // Recording state: stop button with duration
  if (isRecording) {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-50 flex flex-col items-center bg-gradient-to-t from-black/60 to-transparent pb-10 pt-16">
        <p className="mb-3 font-mono text-lg font-bold text-white">
          {formatTime(elapsed)}
        </p>
        <button
          type="button"
          onClick={onStopRecording}
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-transparent transition-all hover:bg-white/10 active:scale-90"
          aria-label="Stop recording"
        >
          <Square className="h-6 w-6 fill-white text-white" />
        </button>
        <p className="mt-2 text-xs text-white/60">Tap to stop</p>
      </div>
    );
  }

  // Pre-recording: record button
  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 flex flex-col items-center bg-gradient-to-t from-black/60 to-transparent pb-10 pt-16">
      <button
        type="button"
        onClick={onStartRecording}
        className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white transition-all hover:scale-105 active:scale-95"
        aria-label="Start recording"
      >
        <span className="h-14 w-14 rounded-full bg-red-500" />
      </button>
      <p className="mt-3 text-xs text-white/60">Tap to record</p>
    </div>
  );
}
