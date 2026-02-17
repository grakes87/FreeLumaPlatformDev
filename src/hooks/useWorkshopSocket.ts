'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkshopState {
  status: 'scheduled' | 'lobby' | 'live' | 'ended' | 'cancelled';
  startedAt: Date | null;
  endedAt: Date | null;
  hostId: number;
  coHostIds: number[];
}

export interface AttendeeInfo {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  isHost: boolean;
  isCoHost: boolean;
  canSpeak: boolean;
}

export interface UseWorkshopSocketReturn {
  socket: Socket | null;
  connected: boolean;
  workshopState: WorkshopState | null;
  attendees: AttendeeInfo[];
  raisedHands: number[];
  // Actions
  joinWorkshop: () => void;
  leaveWorkshop: () => void;
  raiseHand: () => void;
  lowerHand: () => void;
  approveSpeaker: (userId: number) => void;
  revokeSpeaker: (userId: number) => void;
  promoteCoHost: (userId: number) => void;
  demoteCoHost: (userId: number) => void;
  muteUser: (userId: number) => void;
  removeUser: (userId: number) => void;
  banUser: (targetUserId: number, reason?: string) => void;
}

const DEFAULT_STATE: WorkshopState = {
  status: 'scheduled',
  startedAt: null,
  endedAt: null,
  hostId: 0,
  coHostIds: [],
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkshopSocket(workshopId: number | null): UseWorkshopSocketReturn {
  const { isAuthenticated, authToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [workshopState, setWorkshopState] = useState<WorkshopState | null>(null);
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [raisedHands, setRaisedHands] = useState<number[]>([]);

  // Ref for stable cleanup
  const workshopIdRef = useRef(workshopId);
  workshopIdRef.current = workshopId;

  // --- Connect to /workshop namespace ---
  useEffect(() => {
    if (!isAuthenticated || !workshopId) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      setConnected(false);
      setWorkshopState(null);
      setAttendees([]);
      setRaisedHands([]);
      return;
    }

    let cancelled = false;
    let sock: Socket | null = null;

    async function initAndConnect() {
      // Trigger server-side Socket.IO namespace setup
      try {
        await fetch('/api/socket-init');
      } catch {
        // Non-fatal
      }

      if (cancelled) return;

      sock = io('/workshop', {
        autoConnect: true,
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        ...(authToken ? { auth: { token: authToken } } : {}),
      });

      if (cancelled) {
        sock.disconnect();
        return;
      }

      setSocket(sock);

      // --- Connection lifecycle ---
      sock.on('connect', () => {
        setConnected(true);
        // Auto-join the workshop room on connect
        if (workshopIdRef.current) {
          sock?.emit('workshop:join', { workshopId: workshopIdRef.current });
        }
      });

      sock.on('disconnect', () => {
        setConnected(false);
      });

      sock.on('connect_error', (err) => {
        console.error('[useWorkshopSocket] connect_error:', err.message);
      });

      // --- Workshop state events ---
      sock.on('workshop:state', (data: {
        status: WorkshopState['status'];
        attendees: AttendeeInfo[];
        hostId: number;
        coHostIds: number[];
        startedAt: string | null;
      }) => {
        setWorkshopState({
          status: data.status,
          startedAt: data.startedAt ? new Date(data.startedAt) : null,
          endedAt: null,
          hostId: data.hostId,
          coHostIds: data.coHostIds,
        });
        setAttendees(data.attendees);
      });

      sock.on('workshop:state-changed', (data: {
        status: WorkshopState['status'];
        startedAt: string | null;
        endedAt: string | null;
      }) => {
        setWorkshopState((prev) => prev ? {
          ...prev,
          status: data.status,
          startedAt: data.startedAt ? new Date(data.startedAt) : prev.startedAt,
          endedAt: data.endedAt ? new Date(data.endedAt) : prev.endedAt,
        } : prev);
      });

      // --- Attendee events ---
      sock.on('workshop:user-joined', (data: AttendeeInfo) => {
        setAttendees((prev) => {
          // Avoid duplicates
          const filtered = prev.filter((a) => a.userId !== data.userId);
          return [...filtered, data];
        });
      });

      sock.on('workshop:user-left', (data: { userId: number }) => {
        setAttendees((prev) => prev.filter((a) => a.userId !== data.userId));
        setRaisedHands((prev) => prev.filter((id) => id !== data.userId));
      });

      sock.on('workshop:user-removed', (data: { userId: number }) => {
        setAttendees((prev) => prev.filter((a) => a.userId !== data.userId));
        setRaisedHands((prev) => prev.filter((id) => id !== data.userId));
      });

      // --- Hand raise events ---
      sock.on('workshop:hand-raised', (data: { userId: number }) => {
        setRaisedHands((prev) => prev.includes(data.userId) ? prev : [...prev, data.userId]);
      });

      sock.on('workshop:hand-lowered', (data: { userId: number }) => {
        setRaisedHands((prev) => prev.filter((id) => id !== data.userId));
      });

      // --- Speaker/co-host events ---
      sock.on('workshop:speaker-approved', (data: { userId: number }) => {
        setAttendees((prev) => prev.map((a) =>
          a.userId === data.userId ? { ...a, canSpeak: true } : a
        ));
        // Lower hand when speaker is approved
        setRaisedHands((prev) => prev.filter((id) => id !== data.userId));
      });

      sock.on('workshop:speaker-revoked', (data: { userId: number }) => {
        setAttendees((prev) => prev.map((a) =>
          a.userId === data.userId ? { ...a, canSpeak: false } : a
        ));
      });

      sock.on('workshop:cohost-promoted', (data: { userId: number }) => {
        setAttendees((prev) => prev.map((a) =>
          a.userId === data.userId ? { ...a, isCoHost: true, canSpeak: true } : a
        ));
        setWorkshopState((prev) => prev ? {
          ...prev,
          coHostIds: prev.coHostIds.includes(data.userId)
            ? prev.coHostIds
            : [...prev.coHostIds, data.userId],
        } : prev);
      });

      sock.on('workshop:cohost-demoted', (data: { userId: number }) => {
        setAttendees((prev) => prev.map((a) =>
          a.userId === data.userId ? { ...a, isCoHost: false } : a
        ));
        setWorkshopState((prev) => prev ? {
          ...prev,
          coHostIds: prev.coHostIds.filter((id) => id !== data.userId),
        } : prev);
      });

      // --- Mute event (client handles actual Agora muting) ---
      sock.on('workshop:user-muted', (_data: { userId: number }) => {
        // Client components listen for this to trigger local Agora mute
      });

      // --- Error events ---
      sock.on('workshop:error', (data: { event: string; message: string }) => {
        console.error(`[useWorkshopSocket] ${data.event}: ${data.message}`);
      });
    }

    initAndConnect();

    return () => {
      cancelled = true;
      if (sock) {
        // Emit leave before disconnecting
        if (workshopIdRef.current) {
          sock.emit('workshop:leave', { workshopId: workshopIdRef.current });
        }
        sock.off('connect');
        sock.off('disconnect');
        sock.off('connect_error');
        sock.off('workshop:state');
        sock.off('workshop:state-changed');
        sock.off('workshop:user-joined');
        sock.off('workshop:user-left');
        sock.off('workshop:user-removed');
        sock.off('workshop:hand-raised');
        sock.off('workshop:hand-lowered');
        sock.off('workshop:speaker-approved');
        sock.off('workshop:speaker-revoked');
        sock.off('workshop:cohost-promoted');
        sock.off('workshop:cohost-demoted');
        sock.off('workshop:user-muted');
        sock.off('workshop:error');
        sock.disconnect();
      }
      setSocket(null);
      setConnected(false);
      setWorkshopState(null);
      setAttendees([]);
      setRaisedHands([]);
    };
  }, [isAuthenticated, authToken, workshopId]);

  // --- Action functions ---

  const joinWorkshop = useCallback(() => {
    if (socket && workshopId) {
      socket.emit('workshop:join', { workshopId });
    }
  }, [socket, workshopId]);

  const leaveWorkshop = useCallback(() => {
    if (socket && workshopId) {
      socket.emit('workshop:leave', { workshopId });
    }
  }, [socket, workshopId]);

  const raiseHand = useCallback(() => {
    if (socket && workshopId) {
      socket.emit('workshop:raise-hand', { workshopId });
    }
  }, [socket, workshopId]);

  const lowerHand = useCallback(() => {
    if (socket && workshopId) {
      socket.emit('workshop:lower-hand', { workshopId });
    }
  }, [socket, workshopId]);

  const approveSpeaker = useCallback((targetUserId: number) => {
    if (socket && workshopId) {
      socket.emit('workshop:approve-speaker', { workshopId, targetUserId });
    }
  }, [socket, workshopId]);

  const revokeSpeaker = useCallback((targetUserId: number) => {
    if (socket && workshopId) {
      socket.emit('workshop:revoke-speaker', { workshopId, targetUserId });
    }
  }, [socket, workshopId]);

  const promoteCoHost = useCallback((targetUserId: number) => {
    if (socket && workshopId) {
      socket.emit('workshop:promote-cohost', { workshopId, targetUserId });
    }
  }, [socket, workshopId]);

  const demoteCoHost = useCallback((targetUserId: number) => {
    if (socket && workshopId) {
      socket.emit('workshop:demote-cohost', { workshopId, targetUserId });
    }
  }, [socket, workshopId]);

  const muteUser = useCallback((targetUserId: number) => {
    if (socket && workshopId) {
      socket.emit('workshop:mute-user', { workshopId, targetUserId });
    }
  }, [socket, workshopId]);

  const removeUser = useCallback((targetUserId: number) => {
    if (socket && workshopId) {
      socket.emit('workshop:remove-user', { workshopId, targetUserId });
    }
  }, [socket, workshopId]);

  const banUser = useCallback((targetUserId: number, reason?: string) => {
    if (socket && workshopId) {
      socket.emit('workshop:ban-user', { workshopId, targetUserId, reason });
    }
  }, [socket, workshopId]);

  return {
    socket,
    connected,
    workshopState,
    attendees,
    raisedHands,
    joinWorkshop,
    leaveWorkshop,
    raiseHand,
    lowerHand,
    approveSpeaker,
    revokeSpeaker,
    promoteCoHost,
    demoteCoHost,
    muteUser,
    removeUser,
    banUser,
  };
}
