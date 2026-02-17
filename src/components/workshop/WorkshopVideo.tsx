'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Wifi,
  WifiOff,
  Loader2,
  Hand,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import type { AttendeeInfo } from '@/hooks/useWorkshopSocket';

// ---------------------------------------------------------------------------
// Agora imports — safe here because WorkshopVideo is only rendered inside
// dynamically-imported WorkshopRoom (ssr:false), so these will never run
// during SSR.
// ---------------------------------------------------------------------------
import AgoraRTC, {
  AgoraRTCProvider,
  useLocalMicrophoneTrack,
  useLocalCameraTrack,
  usePublish,
  useRemoteUsers,
  useConnectionState,
  LocalVideoTrack,
  RemoteUser,
} from 'agora-rtc-react';

import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkshopVideoProps {
  appId: string;
  channelName: string;
  token: string;
  uid: number;
  role: 'host' | 'audience';
  isHost: boolean;
  isCoHost: boolean;
  canSpeak: boolean;
  attendees: AttendeeInfo[];
  raisedHands: number[];
  socketActions: {
    raiseHand: () => void;
    lowerHand: () => void;
    approveSpeaker: (userId: number) => void;
    revokeSpeaker: (userId: number) => void;
    muteUser: (userId: number) => void;
  };
}

interface DeviceInfo {
  deviceId: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Outer wrapper — creates Agora client and provides context
// ---------------------------------------------------------------------------

export function WorkshopVideo(props: WorkshopVideoProps) {
  const { appId } = props;

  // Create Agora client with mode: 'live' (mandatory for host/audience roles)
  const client = useMemo(
    () => AgoraRTC.createClient({ mode: 'live', codec: 'vp8' }),
    []
  );

  if (!appId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-yellow-400" />
          <p className="mt-2 text-sm text-white/60">Video not configured</p>
          <p className="mt-1 text-xs text-white/40">
            AGORA_APP_ID is not set in the environment
          </p>
        </div>
      </div>
    );
  }

  return (
    <AgoraRTCProvider client={client}>
      <VideoRoom {...props} client={client} />
    </AgoraRTCProvider>
  );
}

// ---------------------------------------------------------------------------
// Inner room — uses Agora hooks (requires AgoraRTCProvider ancestor)
// ---------------------------------------------------------------------------

interface VideoRoomProps extends WorkshopVideoProps {
  client: IAgoraRTCClient;
}

function VideoRoom({
  appId,
  channelName,
  token,
  uid,
  role,
  isHost,
  isCoHost,
  canSpeak,
  attendees,
  raisedHands,
  socketActions,
  client,
}: VideoRoomProps) {
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);

  // Device picker state
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');

  const screenClientRef = useRef<IAgoraRTCClient | null>(null);
  const screenTrackRef = useRef<ReturnType<typeof AgoraRTC.createScreenVideoTrack> | null>(null);
  const devicePickerRef = useRef<HTMLDivElement>(null);
  const videoAreaRef = useRef<HTMLDivElement>(null);

  // Track portrait orientation for screen share rotation on mobile
  const [isPortrait, setIsPortrait] = useState(false);
  const [areaDims, setAreaDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    const onOrientationChange = () => setTimeout(check, 150);
    window.addEventListener('orientationchange', onOrientationChange);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, []);

  // Measure the video area container for rotation calculations
  useEffect(() => {
    const el = videoAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setAreaDims({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isPublisher = role === 'host'; // host/co-host/speaker -> 'host' role from token
  const showCamera = isHost || isCoHost; // Only host/co-host get camera
  const showMic = isPublisher; // host/co-host/speaker get mic

  // Set client role THEN join — must be sequential because Agora live mode
  // defaults to 'audience'. If join() resolves before setClientRole('host'),
  // the host joins as audience and usePublish silently fails to publish,
  // making the host invisible to all other participants.
  const [joinLoading, setJoinLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000;

    async function setupAndJoin() {
      try {
        // 1. Set role FIRST — must resolve before join
        await client.setClientRole(role);
        if (cancelled) return;
      } catch (err) {
        console.error('[WorkshopVideo] setClientRole error:', err);
        // Continue anyway — join may still work with default role
      }

      // 2. Then join with retry
      while (attempt < MAX_RETRIES && !cancelled) {
        attempt++;
        try {
          await client.join(appId, channelName, token, uid);
          if (!cancelled) setJoinLoading(false);
          return;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[WorkshopVideo] Join attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`);
          if (cancelled) return;
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            if (cancelled) return;
          } else {
            setConnectionError(
              'Unable to connect to video. Please check your network and try again.'
            );
            setJoinLoading(false);
          }
        }
      }
    }

    setupAndJoin();

    return () => {
      cancelled = true;
      client.leave().catch(() => {});
    };
  }, [client, appId, channelName, token, uid, role]);

  // Local tracks (only create if publisher)
  const { localMicrophoneTrack, isLoading: micLoading } = useLocalMicrophoneTrack(
    isPublisher && showMic,
    selectedMicId ? { microphoneId: selectedMicId } : undefined
  );
  const { localCameraTrack, isLoading: cameraLoading } = useLocalCameraTrack(
    isPublisher && showCamera,
    selectedCameraId ? { cameraId: selectedCameraId } : undefined
  );

  // Enumerate devices on mount (if publisher)
  useEffect(() => {
    if (!isPublisher) return;

    async function enumerateDevices() {
      try {
        const devices = await AgoraRTC.getDevices();
        const cams = devices
          .filter((d) => d.kind === 'videoinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 6)}` }));
        const mics = devices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 6)}` }));

        setCameras(cams);
        setMicrophones(mics);

        // Restore from localStorage
        const savedCam = localStorage.getItem('workshop_camera_id');
        const savedMic = localStorage.getItem('workshop_mic_id');
        if (savedCam && cams.some((c) => c.deviceId === savedCam)) {
          setSelectedCameraId(savedCam);
        }
        if (savedMic && mics.some((m) => m.deviceId === savedMic)) {
          setSelectedMicId(savedMic);
        }
      } catch (err) {
        console.error('[WorkshopVideo] getDevices error:', err);
      }
    }

    enumerateDevices();
  }, [isPublisher]);

  // Close device picker on outside click
  useEffect(() => {
    if (!showDevicePicker) return;
    const handleClick = (e: MouseEvent) => {
      if (devicePickerRef.current && !devicePickerRef.current.contains(e.target as Node)) {
        setShowDevicePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDevicePicker]);

  // Build publish tracks array
  const publishTracks = useMemo(() => {
    const tracks: (ICameraVideoTrack | IMicrophoneAudioTrack | null)[] = [];
    if (showCamera) tracks.push(localCameraTrack ?? null);
    if (showMic) tracks.push(localMicrophoneTrack ?? null);
    return tracks;
  }, [localCameraTrack, localMicrophoneTrack, showCamera, showMic]);

  // Connection state
  const connectionState = useConnectionState(client);
  const isConnected = connectionState === 'CONNECTED';

  // Publish local tracks
  usePublish(publishTracks, isPublisher && isConnected, client);

  // Remote users
  const remoteUsers = useRemoteUsers(client);

  // Toggle mic
  const toggleMic = useCallback(async () => {
    if (localMicrophoneTrack) {
      await localMicrophoneTrack.setEnabled(!micEnabled);
      setMicEnabled(!micEnabled);
    }
  }, [localMicrophoneTrack, micEnabled]);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (localCameraTrack) {
      await localCameraTrack.setEnabled(!cameraEnabled);
      setCameraEnabled(!cameraEnabled);
    }
  }, [localCameraTrack, cameraEnabled]);

  // Device change handlers
  const handleCameraChange = useCallback(async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    localStorage.setItem('workshop_camera_id', deviceId);
    if (localCameraTrack) {
      try {
        await (localCameraTrack as unknown as { setDevice: (id: string) => Promise<void> }).setDevice(deviceId);
      } catch (err) {
        console.error('[WorkshopVideo] setDevice camera error:', err);
      }
    }
  }, [localCameraTrack]);

  const handleMicChange = useCallback(async (deviceId: string) => {
    setSelectedMicId(deviceId);
    localStorage.setItem('workshop_mic_id', deviceId);
    if (localMicrophoneTrack) {
      try {
        await (localMicrophoneTrack as unknown as { setDevice: (id: string) => Promise<void> }).setDevice(deviceId);
      } catch (err) {
        console.error('[WorkshopVideo] setDevice mic error:', err);
      }
    }
  }, [localMicrophoneTrack]);

  // Raise / lower hand (for attendees who are not speakers)
  const toggleHand = useCallback(() => {
    if (handRaised) {
      socketActions.lowerHand();
      setHandRaised(false);
    } else {
      socketActions.raiseHand();
      setHandRaised(true);
    }
  }, [handRaised, socketActions]);

  // Stop screen share helper (stable via ref to avoid circular useCallback)
  const stopScreenShare = useCallback(async () => {
    try {
      if (screenTrackRef.current) {
        const result = await screenTrackRef.current;
        if (Array.isArray(result)) {
          result.forEach((t) => t.close());
        } else {
          result.close();
        }
        screenTrackRef.current = null;
      }
      if (screenClientRef.current) {
        await screenClientRef.current.leave();
        screenClientRef.current = null;
      }
    } catch (err) {
      console.error('[WorkshopVideo] stop screen share error:', err);
    }
    setIsScreenSharing(false);
  }, []);

  // Use ref so the track-ended handler always calls the latest stop function
  const stopScreenShareRef = useRef(stopScreenShare);
  stopScreenShareRef.current = stopScreenShare;

  // Screen share toggle
  const toggleScreenShare = useCallback(async (): Promise<void> => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      // Start screen share
      try {
        const screenClient = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        await screenClient.setClientRole('host');

        const screenUid = uid + 100000;

        // Fetch a token minted for the screen-share UID (must match the uid
        // passed to client.join or Agora rejects with "invalid token")
        const tokenRes = await fetch(
          `/api/workshops/${channelName.replace('workshop-', '')}/token?uid=${screenUid}`,
          { credentials: 'include' }
        );
        if (!tokenRes.ok) {
          throw new Error('Failed to obtain screen-share token');
        }
        const tokenJson = await tokenRes.json();
        const tokenData = tokenJson.data ?? tokenJson;
        const screenToken = tokenData.token;
        if (!screenToken) {
          throw new Error('Screen-share token was empty');
        }

        await screenClient.join(appId, channelName, screenToken, screenUid);

        const screenTrack = await AgoraRTC.createScreenVideoTrack(
          { encoderConfig: '1080p_2' },
          'auto'
        );

        // Handle browser's native "Stop sharing" button
        const onTrackEnded = () => { stopScreenShareRef.current(); };

        if (!Array.isArray(screenTrack)) {
          screenTrack.on('track-ended', onTrackEnded);
          await screenClient.publish(screenTrack);
        } else {
          const [videoTrack] = screenTrack;
          videoTrack.on('track-ended', onTrackEnded);
          await screenClient.publish(screenTrack);
        }

        screenClientRef.current = screenClient;
        screenTrackRef.current = Promise.resolve(screenTrack);
        setIsScreenSharing(true);
      } catch (err) {
        console.error('[WorkshopVideo] start screen share error:', err);
        // User may have cancelled the browser prompt
        if (screenClientRef.current) {
          await screenClientRef.current.leave().catch(() => {});
          screenClientRef.current = null;
        }
      }
    }
  }, [isScreenSharing, uid, appId, channelName, token, stopScreenShare]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop screen share if active
      if (screenClientRef.current) {
        screenClientRef.current.leave().catch(() => {});
      }
    };
  }, []);

  // Connection error state
  if (connectionError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center">
          <WifiOff className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-3 text-sm text-white">{connectionError}</p>
          <button
            type="button"
            onClick={() => {
              setConnectionError(null);
              window.location.reload();
            }}
            className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (joinLoading || !isConnected) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/50" />
          <p className="mt-2 text-xs text-white/40">Connecting to video...</p>
        </div>
      </div>
    );
  }

  // Split remote users into screen-share vs camera feeds
  const screenShareUsers = remoteUsers.filter((u) => Number(u.uid) > 100000);
  const cameraUsers = remoteUsers.filter((u) => Number(u.uid) <= 100000);
  const hasScreenShare = screenShareUsers.length > 0 || isScreenSharing;

  // On portrait mobile, rotate screen share to landscape orientation
  const shouldRotateScreenShare = isPortrait && hasScreenShare && areaDims.width > 0;

  // Total video feeds = local (if publisher+camera) + camera remote users
  const cameraFeedCount = (isPublisher && showCamera ? 1 : 0) + cameraUsers.length;

  return (
    <div className="flex flex-1 flex-col">
      {/* Connection indicator */}
      <div className="flex items-center gap-1.5 px-3 py-1">
        <Wifi className={cn(
          'h-3 w-3',
          connectionState === 'CONNECTED' ? 'text-green-400' : 'text-yellow-400'
        )} />
        <span className="text-[10px] text-white/40">
          {connectionState === 'CONNECTED'
            ? 'Connected'
            : connectionState === 'RECONNECTING'
              ? 'Reconnecting...'
              : connectionState}
        </span>
      </div>

      {/* Video area */}
      <div ref={videoAreaRef} className="relative flex flex-1 flex-col min-h-0">
        {hasScreenShare ? (
          /* ── Screen-share layout: full-screen share + PiP camera feeds ── */
          <>
            {/* Screen share — fills the area; rotated on portrait mobile */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
              {screenShareUsers.map((user) => (
                <div
                  key={user.uid}
                  className="overflow-hidden rounded-xl bg-gray-800"
                  style={shouldRotateScreenShare ? {
                    width: `${areaDims.height - 16}px`,
                    height: `${areaDims.width - 16}px`,
                    transform: 'rotate(90deg)',
                    transformOrigin: 'center center',
                  } : {
                    width: '100%',
                    height: '100%',
                    margin: '8px',
                  }}
                >
                  <RemoteUser
                    user={user}
                    playVideo
                    playAudio
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  <VideoOverlay
                    name="Screen Share"
                    isMuted={false}
                    isScreenShare
                  />
                </div>
              ))}

              {/* Local screen share (host sees their own share here) */}
              {isScreenSharing && screenShareUsers.length === 0 && (
                <div
                  className="flex items-center justify-center overflow-hidden rounded-xl bg-gray-800"
                  style={shouldRotateScreenShare ? {
                    width: `${areaDims.height - 16}px`,
                    height: `${areaDims.width - 16}px`,
                    transform: 'rotate(90deg)',
                    transformOrigin: 'center center',
                  } : {
                    width: '100%',
                    height: '100%',
                    margin: '8px',
                  }}
                >
                  <div className="text-center">
                    <Monitor className="mx-auto h-8 w-8 text-green-400" />
                    <p className="mt-2 text-xs text-white/50">You are sharing your screen</p>
                  </div>
                </div>
              )}
            </div>

            {/* PiP camera feeds — always visible (NOT rotated) */}
            <div className="absolute left-2 top-2 z-10 flex flex-col gap-2 sm:left-3 sm:top-3">
              {/* Local camera PiP */}
              {isPublisher && showCamera && localCameraTrack && (
                <div className="relative h-20 w-28 overflow-hidden rounded-lg bg-gray-800 shadow-lg ring-1 ring-black/30 sm:h-28 sm:w-40">
                  {cameraEnabled ? (
                    <LocalVideoTrack
                      track={localCameraTrack}
                      play
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <CameraOffPlaceholder name="You" />
                  )}
                  <VideoOverlay
                    name="You"
                    isMuted={!micEnabled}
                    isHost={isHost}
                    isCoHost={isCoHost}
                  />
                </div>
              )}

              {/* Remote camera PiPs */}
              {cameraUsers.map((user) => {
                const attendee = attendees.find((a) => a.userId === Number(user.uid));
                const displayName = attendee?.displayName || `User ${user.uid}`;
                return (
                  <div key={user.uid} className="relative h-20 w-28 overflow-hidden rounded-lg bg-gray-800 shadow-lg ring-1 ring-black/30 sm:h-28 sm:w-40">
                    <RemoteUser
                      user={user}
                      playVideo
                      playAudio
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <VideoOverlay
                      name={displayName}
                      isMuted={false}
                      isHost={attendee?.isHost}
                      isCoHost={attendee?.isCoHost}
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* ── Normal grid layout (no screen share) ── */
          <div
            className={cn(
              'flex-1 grid gap-2 p-2',
              cameraFeedCount <= 1 && 'grid-cols-1 grid-rows-1',
              cameraFeedCount === 2 && 'grid-cols-2 grid-rows-1',
              cameraFeedCount >= 3 && cameraFeedCount <= 4 && 'grid-cols-2 grid-rows-2',
              cameraFeedCount >= 5 && 'grid-cols-3 grid-rows-2'
            )}
          >
            {/* Local video (host/co-host with camera) */}
            {isPublisher && showCamera && localCameraTrack && (
              <div className="relative overflow-hidden rounded-xl bg-gray-800">
                {cameraEnabled ? (
                  <LocalVideoTrack
                    track={localCameraTrack}
                    play
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <CameraOffPlaceholder name="You" />
                )}
                <VideoOverlay
                  name="You"
                  isMuted={!micEnabled}
                  isHost={isHost}
                  isCoHost={isCoHost}
                />
              </div>
            )}

            {/* Local audio-only placeholder (speaker without camera) */}
            {isPublisher && !showCamera && (
              <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-gray-800">
                <CameraOffPlaceholder name="You" />
                <VideoOverlay
                  name="You"
                  isMuted={!micEnabled}
                />
              </div>
            )}

            {/* Remote camera videos */}
            {cameraUsers.map((user) => {
              const attendee = attendees.find((a) => a.userId === Number(user.uid));
              const displayName = attendee?.displayName || `User ${user.uid}`;
              return (
                <div key={user.uid} className="relative overflow-hidden rounded-xl bg-gray-800">
                  <RemoteUser
                    user={user}
                    playVideo
                    playAudio
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <VideoOverlay
                    name={displayName}
                    isMuted={false}
                    isHost={attendee?.isHost}
                    isCoHost={attendee?.isCoHost}
                  />
                </div>
              );
            })}

            {/* No video feeds — audience with no publishers */}
            {cameraFeedCount === 0 && (
              <div className="flex items-center justify-center rounded-xl bg-gray-800/50">
                <div className="text-center">
                  <VideoOff className="mx-auto h-8 w-8 text-white/30" />
                  <p className="mt-2 text-xs text-white/40">
                    {isPublisher
                      ? 'Camera is off'
                      : 'Waiting for host video...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls bar — frosted glass */}
      <div className="relative flex shrink-0 items-center justify-center gap-2 px-4 py-3">
        <div className="absolute inset-0 rounded-t-2xl border-t border-white/10 backdrop-blur-md bg-black/40" />

        <div className="relative z-10 flex items-center gap-2">
          {/* Mic toggle (publisher only) */}
          {showMic && (
            <ControlButton
              active={micEnabled}
              onClick={toggleMic}
              icon={micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              label={micEnabled ? 'Mute' : 'Unmute'}
              activeColor="bg-white/10"
              inactiveColor="bg-red-500/80"
            />
          )}

          {/* Camera toggle (host/co-host only) */}
          {showCamera && (
            <ControlButton
              active={cameraEnabled}
              onClick={toggleCamera}
              icon={cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              label={cameraEnabled ? 'Camera Off' : 'Camera On'}
              activeColor="bg-white/10"
              inactiveColor="bg-red-500/80"
            />
          )}

          {/* Divider */}
          {(showMic || showCamera) && (isHost || isCoHost) && (
            <div className="mx-1 h-6 w-px bg-white/20" />
          )}

          {/* Screen share (host/co-host only) */}
          {(isHost || isCoHost) && (
            <ControlButton
              active={!isScreenSharing}
              onClick={toggleScreenShare}
              icon={isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
              activeColor="bg-white/10"
              inactiveColor="bg-green-600/80"
            />
          )}

          {/* Raise hand (audience/non-speakers) */}
          {!isPublisher && (
            <ControlButton
              active={!handRaised}
              onClick={toggleHand}
              icon={<Hand className="h-5 w-5" />}
              label={handRaised ? 'Lower Hand' : 'Raise Hand'}
              activeColor="bg-white/10"
              inactiveColor="bg-amber-500/80"
            />
          )}

          {/* Settings / Device picker (publisher only) */}
          {isPublisher && (cameras.length > 0 || microphones.length > 0) && (
            <>
              {(isHost || isCoHost || !isPublisher) ? null : null}
              <div className="mx-1 h-6 w-px bg-white/20" />
              <div className="relative" ref={devicePickerRef}>
                <ControlButton
                  active={!showDevicePicker}
                  onClick={() => setShowDevicePicker(!showDevicePicker)}
                  icon={<Settings className="h-5 w-5" />}
                  label="Settings"
                  activeColor="bg-white/10"
                  inactiveColor="bg-white/20"
                />

                {/* Device picker popover */}
                {showDevicePicker && (
                  <div className="absolute bottom-full left-1/2 z-50 mb-3 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-gray-900/95 p-3 shadow-2xl backdrop-blur-lg">
                    <div className="space-y-3">
                      {/* Camera select */}
                      {showCamera && cameras.length > 0 && (
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-white/50 uppercase tracking-wider">
                            Camera
                          </label>
                          <select
                            value={selectedCameraId}
                            onChange={(e) => handleCameraChange(e.target.value)}
                            className="w-full rounded-lg bg-white/10 px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="" className="bg-gray-900">Default</option>
                            {cameras.map((cam) => (
                              <option key={cam.deviceId} value={cam.deviceId} className="bg-gray-900">
                                {cam.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Mic select */}
                      {microphones.length > 0 && (
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-white/50 uppercase tracking-wider">
                            Microphone
                          </label>
                          <select
                            value={selectedMicId}
                            onChange={(e) => handleMicChange(e.target.value)}
                            className="w-full rounded-lg bg-white/10 px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="" className="bg-gray-900">Default</option>
                            {microphones.map((mic) => (
                              <option key={mic.deviceId} value={mic.deviceId} className="bg-gray-900">
                                {mic.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CameraOffPlaceholder({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
          <span className="text-xl font-bold text-primary">{initials}</span>
        </div>
        <p className="mt-2 text-xs text-white/50">{name}</p>
      </div>
    </div>
  );
}

function VideoOverlay({
  name,
  isMuted,
  isHost,
  isCoHost,
  isScreenShare,
}: {
  name: string;
  isMuted?: boolean;
  isHost?: boolean;
  isCoHost?: boolean;
  isScreenShare?: boolean;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-white/90 drop-shadow">{name}</span>
        {isHost && (
          <span className="rounded bg-amber-500/30 px-1 py-0.5 text-[9px] font-bold text-amber-300">
            HOST
          </span>
        )}
        {isCoHost && !isHost && (
          <span className="rounded bg-blue-500/30 px-1 py-0.5 text-[9px] font-bold text-blue-300">
            CO-HOST
          </span>
        )}
        {isScreenShare && (
          <span className="rounded bg-green-500/30 px-1 py-0.5 text-[9px] font-bold text-green-300">
            SCREEN
          </span>
        )}
      </div>
      {isMuted && (
        <MicOff className="h-3.5 w-3.5 text-red-400" />
      )}
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  icon,
  label,
  activeColor,
  inactiveColor,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeColor: string;
  inactiveColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full px-4 py-2.5 text-white transition-colors',
        active ? activeColor : inactiveColor,
        'hover:opacity-80'
      )}
      title={label}
    >
      {icon}
      <span className="hidden text-xs font-medium sm:inline">{label}</span>
    </button>
  );
}
