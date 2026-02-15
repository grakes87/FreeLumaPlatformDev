'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { CalendarCheck, CalendarX, Loader2 } from 'lucide-react';

interface RSVPButtonProps {
  workshopId: number;
  initialRsvp: boolean;
  workshopStatus: string;
  isHost: boolean;
  onRsvpChange?: (isRsvpd: boolean) => void;
}

export function RSVPButton({
  workshopId,
  initialRsvp,
  workshopStatus,
  isHost,
  onRsvpChange,
}: RSVPButtonProps) {
  const toast = useToast();
  const [rsvpd, setRsvpd] = useState(initialRsvp);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    if (loading) return;

    const newState = !rsvpd;

    // Optimistic update
    setRsvpd(newState);
    onRsvpChange?.(newState);
    setLoading(true);

    try {
      const res = await fetch(`/api/workshops/${workshopId}/rsvp`, {
        method: newState ? 'POST' : 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        // Revert optimistic update
        setRsvpd(!newState);
        onRsvpChange?.(!newState);

        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to update RSVP');
      }
    } catch {
      // Revert optimistic update
      setRsvpd(!newState);
      onRsvpChange?.(!newState);
      toast.error('Failed to update RSVP');
    } finally {
      setLoading(false);
    }
  }, [workshopId, rsvpd, loading, onRsvpChange, toast]);

  // Host: show "You're the host"
  if (isHost) {
    return (
      <Button variant="secondary" fullWidth disabled>
        <CalendarCheck className="h-4 w-4" />
        You are the host
      </Button>
    );
  }

  // Not schedulable: RSVP closed
  if (workshopStatus !== 'scheduled') {
    return (
      <Button variant="secondary" fullWidth disabled>
        RSVP closed
      </Button>
    );
  }

  // RSVP'd: show Cancel RSVP
  if (rsvpd) {
    return (
      <Button
        variant="outline"
        fullWidth
        loading={loading}
        onClick={handleToggle}
      >
        <CalendarX className="h-4 w-4" />
        Cancel RSVP
      </Button>
    );
  }

  // Not RSVP'd: show RSVP
  return (
    <Button
      variant="primary"
      fullWidth
      loading={loading}
      onClick={handleToggle}
    >
      <CalendarCheck className="h-4 w-4" />
      RSVP
    </Button>
  );
}
