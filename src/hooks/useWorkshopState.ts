'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshopSocket, type WorkshopState, type AttendeeInfo } from '@/hooks/useWorkshopSocket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkshopLifecycleState = 'loading' | 'lobby' | 'live' | 'ended' | 'error';

export interface WorkshopData {
  id: number;
  title: string;
  description: string | null;
  status: string;
  scheduled_at: string;
  duration_minutes: number | null;
  is_private: boolean;
  max_capacity: number | null;
  attendee_count: number;
  host_id: number;
  agora_channel: string | null;
  host: {
    id: number;
    display_name: string;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
  };
}

export interface UseWorkshopStateReturn {
  state: WorkshopLifecycleState;
  workshop: WorkshopData | null;
  isHost: boolean;
  isCoHost: boolean;
  canSpeak: boolean;
  agoraToken: string | null;
  agoraChannel: string | null;
  agoraUid: number | null;
  agoraAppId: string | null;
  agoraRole: 'host' | 'audience';
  error: string | null;
  // Socket-relayed state
  workshopSocketState: WorkshopState | null;
  attendees: AttendeeInfo[];
  raisedHands: number[];
  // Socket actions (delegated)
  socketActions: {
    raiseHand: () => void;
    lowerHand: () => void;
    approveSpeaker: (userId: number) => void;
    revokeSpeaker: (userId: number) => void;
    promoteCoHost: (userId: number) => void;
    demoteCoHost: (userId: number) => void;
    muteUser: (userId: number) => void;
    removeUser: (userId: number) => void;
  };
  // Lifecycle actions
  startWorkshop: () => Promise<void>;
  endWorkshop: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

// Token refresh interval: 50 minutes (tokens expire at 1h)
const TOKEN_REFRESH_INTERVAL_MS = 50 * 60 * 1000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkshopState(workshopId: number): UseWorkshopStateReturn {
  const { user } = useAuth();

  const [state, setState] = useState<WorkshopLifecycleState>('loading');
  const [workshop, setWorkshop] = useState<WorkshopData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isCoHost, setIsCoHost] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);

  // Agora state
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const [agoraChannel, setAgoraChannel] = useState<string | null>(null);
  const [agoraUid, setAgoraUid] = useState<number | null>(null);
  const [agoraAppId, setAgoraAppId] = useState<string | null>(null);
  const [agoraRole, setAgoraRole] = useState<'host' | 'audience'>('audience');

  const tokenRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Socket connection
  const {
    workshopState: socketState,
    attendees,
    raisedHands,
    raiseHand,
    lowerHand,
    approveSpeaker,
    revokeSpeaker,
    promoteCoHost,
    demoteCoHost,
    muteUser,
    removeUser,
  } = useWorkshopSocket(workshopId);

  // --- Fetch workshop detail on mount ---
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function fetchWorkshop() {
      try {
        const res = await fetch(`/api/workshops/${workshopId}`, {
          credentials: 'include',
        });

        if (cancelled) return;

        if (!res.ok) {
          const text = await res.text().catch(() => 'Unknown error');
          setState('error');
          setError(res.status === 404 ? 'Workshop not found' : text);
          return;
        }

        const json = await res.json();
        const data = json.data ?? json;
        const ws = data.workshop;

        if (cancelled) return;

        setWorkshop(ws);
        setIsHost(data.isHost ?? false);

        const rsvp = data.userRsvp;
        setIsCoHost(rsvp?.is_co_host ?? false);
        setCanSpeak(rsvp?.can_speak ?? rsvp?.is_co_host ?? data.isHost ?? false);

        // Determine initial state based on workshop status
        const status = ws.status;
        if (status === 'live') {
          setState('live');
        } else if (status === 'ended' || status === 'cancelled') {
          setState('ended');
        } else {
          // scheduled, starting_soon, lobby -> lobby
          setState('lobby');
        }
      } catch (err) {
        if (cancelled) return;
        setState('error');
        setError(err instanceof Error ? err.message : 'Failed to load workshop');
      }
    }

    fetchWorkshop();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [workshopId]);

  // --- React to Socket.IO state changes ---
  useEffect(() => {
    if (!socketState) return;

    const status = socketState.status;
    if (status === 'live') {
      setState('live');
    } else if (status === 'ended' || status === 'cancelled') {
      setState('ended');
    } else if (status === 'lobby' || status === 'scheduled') {
      setState('lobby');
    }
  }, [socketState]);

  // --- Update co-host / speaker status from attendees list ---
  useEffect(() => {
    if (!user || attendees.length === 0) return;

    const me = attendees.find((a) => a.userId === user.id);
    if (me) {
      setIsCoHost(me.isCoHost);
      setCanSpeak(me.canSpeak || me.isCoHost || me.isHost);
    }
  }, [attendees, user]);

  // --- Fetch Agora token when state transitions to 'live' ---
  const fetchAgoraToken = useCallback(async () => {
    try {
      const res = await fetch(`/api/workshops/${workshopId}/token`, {
        credentials: 'include',
      });

      if (!res.ok) {
        console.error('[useWorkshopState] Failed to fetch Agora token:', res.status);
        return;
      }

      const json = await res.json();
      const data = json.data ?? json;

      if (!mountedRef.current) return;

      setAgoraToken(data.token);
      setAgoraChannel(data.channelName);
      setAgoraUid(data.uid);
      setAgoraAppId(data.appId);
      setAgoraRole(data.role);
    } catch (err) {
      console.error('[useWorkshopState] Agora token fetch error:', err);
    }
  }, [workshopId]);

  useEffect(() => {
    if (state === 'live') {
      fetchAgoraToken();

      // Auto-refresh token every 50 minutes
      tokenRefreshRef.current = setInterval(() => {
        fetchAgoraToken();
      }, TOKEN_REFRESH_INTERVAL_MS);
    }

    return () => {
      if (tokenRefreshRef.current) {
        clearInterval(tokenRefreshRef.current);
        tokenRefreshRef.current = null;
      }
    };
  }, [state, fetchAgoraToken]);

  // --- Lifecycle actions ---

  const startWorkshop = useCallback(async () => {
    try {
      const res = await fetch(`/api/workshops/${workshopId}/start`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({ message: 'Failed to start' }));
        throw new Error(json.message || 'Failed to start workshop');
      }

      // Socket.IO will broadcast state change, but optimistically update
      setState('live');
    } catch (err) {
      console.error('[useWorkshopState] startWorkshop error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start workshop');
    }
  }, [workshopId]);

  const endWorkshop = useCallback(async () => {
    try {
      const res = await fetch(`/api/workshops/${workshopId}/end`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({ message: 'Failed to end' }));
        throw new Error(json.message || 'Failed to end workshop');
      }

      // Socket.IO will broadcast state change, but optimistically update
      setState('ended');
    } catch (err) {
      console.error('[useWorkshopState] endWorkshop error:', err);
      setError(err instanceof Error ? err.message : 'Failed to end workshop');
    }
  }, [workshopId]);

  const refreshToken = useCallback(async () => {
    await fetchAgoraToken();
  }, [fetchAgoraToken]);

  return {
    state,
    workshop,
    isHost,
    isCoHost,
    canSpeak,
    agoraToken,
    agoraChannel,
    agoraUid,
    agoraAppId,
    agoraRole,
    error,
    workshopSocketState: socketState,
    attendees,
    raisedHands,
    socketActions: {
      raiseHand,
      lowerHand,
      approveSpeaker,
      revokeSpeaker,
      promoteCoHost,
      demoteCoHost,
      muteUser,
      removeUser,
    },
    startWorkshop,
    endWorkshop,
    refreshToken,
  };
}
