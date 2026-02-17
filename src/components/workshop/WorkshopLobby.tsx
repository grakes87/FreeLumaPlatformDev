'use client';

import { useState, useEffect, useMemo } from 'react';
import { Clock, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { Button } from '@/components/ui/Button';
import type { WorkshopData } from '@/hooks/useWorkshopState';
import type { AttendeeInfo } from '@/hooks/useWorkshopSocket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkshopLobbyProps {
  workshop: WorkshopData;
  isHost: boolean;
  attendees: AttendeeInfo[];
  onStart: () => void;
  starting?: boolean;
}

// ---------------------------------------------------------------------------
// Countdown hook
// ---------------------------------------------------------------------------

function useCountdown(targetDate: string) {
  const target = useMemo(() => new Date(targetDate).getTime(), [targetDate]);

  const [remaining, setRemaining] = useState(() => {
    const diff = target - Date.now();
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    if (remaining <= 0) return;

    const interval = setInterval(() => {
      const diff = target - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [target, remaining]);

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  return { remaining, hours, minutes, seconds };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkshopLobby({
  workshop,
  isHost,
  attendees,
  onStart,
  starting = false,
}: WorkshopLobbyProps) {
  const { remaining, hours, minutes, seconds } = useCountdown(workshop.scheduled_at);

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Workshop title */}
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-white">
            {workshop.title}
          </h1>
          <p className="mt-1 text-sm text-text-muted dark:text-white/50">
            Hosted by {workshop.host.display_name}
          </p>
        </div>

        {/* Countdown timer */}
        {remaining > 0 ? (
          <div className="rounded-2xl bg-surface-hover p-6 dark:bg-white/5 dark:backdrop-blur">
            <div className="flex items-center justify-center gap-1.5 text-sm text-text-muted dark:text-white/60">
              <Clock className="h-4 w-4" />
              <span>Starting in</span>
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              {hours > 0 && (
                <CountdownUnit value={hours} label="hr" />
              )}
              <CountdownUnit value={minutes} label="min" />
              <CountdownUnit value={seconds} label="sec" />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface-hover p-6 dark:bg-white/5 dark:backdrop-blur">
            <div className="flex items-center justify-center gap-2 text-text-muted dark:text-white/80">
              {!isHost && (
                <>
                  <WaitingDots />
                  <span className="text-sm">Waiting for host to start</span>
                </>
              )}
              {isHost && (
                <span className="text-sm">Ready to start the workshop</span>
              )}
            </div>
          </div>
        )}

        {/* Host start button */}
        {isHost && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={starting}
            onClick={onStart}
            className="bg-green-600 hover:bg-green-700 focus-visible:ring-green-500/50"
          >
            Start Workshop
          </Button>
        )}

        {/* Attendee list */}
        <div className="rounded-2xl bg-surface-hover p-4 dark:bg-white/5 dark:backdrop-blur">
          <div className="mb-3 flex items-center justify-center gap-1.5 text-sm text-text-muted dark:text-white/60">
            <Users className="h-4 w-4" />
            <span>
              {attendees.length} {attendees.length === 1 ? 'person' : 'people'} in lobby
            </span>
          </div>

          {attendees.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {attendees.slice(0, 20).map((attendee) => (
                <div
                  key={attendee.userId}
                  className="flex items-center gap-2 rounded-full bg-black/5 px-3 py-1.5 dark:bg-white/10"
                >
                  {attendee.avatarUrl ? (
                    <img
                      src={attendee.avatarUrl}
                      alt={attendee.displayName}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <InitialsAvatar
                      name={attendee.displayName}
                      color="#6366f1"
                      size={24}
                      className="text-[10px]"
                    />
                  )}
                  <span className="text-xs text-text dark:text-white/80">
                    {attendee.displayName}
                  </span>
                  {attendee.isHost && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      HOST
                    </span>
                  )}
                  {attendee.isCoHost && !attendee.isHost && (
                    <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                      CO-HOST
                    </span>
                  )}
                </div>
              ))}
              {attendees.length > 20 && (
                <span className="text-xs text-text-muted dark:text-white/50">
                  +{attendees.length - 20} more
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-text-muted dark:text-white/40">No one else is here yet</p>
          )}
        </div>

        {/* Tips */}
        <div className="space-y-2 text-xs text-text-muted dark:text-white/40">
          <p>You will be able to watch the host&apos;s video and raise your hand to speak.</p>
          {isHost && (
            <p>As host, your camera and microphone will be shared when you start.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl font-bold tabular-nums text-text dark:text-white">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-0.5 text-xs text-text-muted dark:text-white/50">{label}</span>
    </div>
  );
}

function WaitingDots() {
  return (
    <span className="flex gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted dark:bg-white/60 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted dark:bg-white/60 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted dark:bg-white/60 [animation-delay:300ms]" />
    </span>
  );
}
