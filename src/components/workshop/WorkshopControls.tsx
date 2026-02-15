'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MonitorUp,
  MonitorOff,
  PhoneOff,
  Users,
  Clock,
  Hand,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkshopControlsProps {
  workshopId: number;
  isHost: boolean;
  isCoHost?: boolean;
  isScreenSharing: boolean;
  /** Workshop start time (actual_started_at) for duration timer */
  startedAt: Date | null;
  /** Number of attendees */
  attendeeCount: number;
  /** Number of raised hands (shown to host/co-host) */
  raisedHandCount?: number;
  /** Whether current user has raised hand */
  hasRaisedHand?: boolean;
  onEndWorkshop: () => void;
  onLeaveWorkshop: () => void;
  onToggleScreenShare: () => void;
  onRaiseHand?: () => void;
  onLowerHand?: () => void;
}

// ---------------------------------------------------------------------------
// Duration Timer Hook
// ---------------------------------------------------------------------------

function useDurationTimer(startedAt: Date | null): string {
  const [elapsed, setElapsed] = useState('00:00');

  const formatDuration = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (!startedAt) {
      setElapsed('00:00');
      return;
    }

    const update = () => {
      const now = Date.now();
      const diff = now - startedAt.getTime();
      setElapsed(formatDuration(Math.max(0, diff)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, formatDuration]);

  return elapsed;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Workshop controls bar.
 * Host/co-host: End workshop, screen share toggle, duration timer, attendee count.
 * Attendee: Leave button, raise hand.
 */
export function WorkshopControls({
  isHost,
  isCoHost = false,
  isScreenSharing,
  startedAt,
  attendeeCount,
  raisedHandCount = 0,
  hasRaisedHand = false,
  onEndWorkshop,
  onLeaveWorkshop,
  onToggleScreenShare,
  onRaiseHand,
  onLowerHand,
}: WorkshopControlsProps) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const duration = useDurationTimer(startedAt);
  const canManage = isHost || isCoHost;

  return (
    <>
      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 backdrop-blur-sm">
        {/* Left: Duration + Attendees */}
        <div className="flex items-center gap-4">
          {/* Duration timer */}
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="font-mono text-slate-200">{duration}</span>
          </div>

          {/* Attendee count */}
          <div className="flex items-center gap-1.5 text-sm">
            <Users className="h-4 w-4 text-slate-400" />
            <span className="text-slate-300">{attendeeCount}</span>
          </div>

          {/* Raised hands indicator (host/co-host only) */}
          {canManage && raisedHandCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <Hand className="h-4 w-4 animate-pulse text-orange-400" />
              <span className="font-medium text-orange-400">
                {raisedHandCount}
              </span>
            </div>
          )}
        </div>

        {/* Center/Right: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Raise hand button (attendees only) */}
          {!canManage && onRaiseHand && onLowerHand && (
            <button
              type="button"
              onClick={hasRaisedHand ? onLowerHand : onRaiseHand}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                hasRaisedHand
                  ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              )}
              title={hasRaisedHand ? 'Lower hand' : 'Raise hand'}
            >
              <Hand className={cn('h-4 w-4', hasRaisedHand && 'animate-pulse')} />
              <span className="hidden sm:inline">
                {hasRaisedHand ? 'Lower' : 'Raise'}
              </span>
            </button>
          )}

          {/* Screen share toggle (host/co-host) */}
          {canManage && (
            <button
              type="button"
              onClick={onToggleScreenShare}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                isScreenSharing
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              )}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              {isScreenSharing ? (
                <MonitorOff className="h-4 w-4" />
              ) : (
                <MonitorUp className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isScreenSharing ? 'Stop Share' : 'Share Screen'}
              </span>
            </button>
          )}

          {/* Leave / End button */}
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
              title="End Workshop"
            >
              <PhoneOff className="h-4 w-4" />
              <span className="hidden sm:inline">End Workshop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onLeaveWorkshop}
              className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/20 hover:text-red-400"
              title="Leave Workshop"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          )}
        </div>
      </div>

      {/* End Workshop Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showEndConfirm}
        onClose={() => setShowEndConfirm(false)}
        onConfirm={onEndWorkshop}
        title="End Workshop"
        message="This will end the workshop for all participants. This action cannot be undone."
        confirmLabel="End Workshop"
        cancelLabel="Cancel"
        danger
      />
    </>
  );
}
