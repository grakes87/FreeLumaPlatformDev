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
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { AttendeeInfo } from '@/hooks/useWorkshopSocket';

// ---------------------------------------------------------------------------
// Agora imports — safe here because WorkshopVideo is only rendered inside
// dynamically-imported WorkshopRoom (ssr:false), so these will never run
// during SSR.
// ---------------------------------------------------------------------------
import AgoraRTC, {
  AgoraRTCProvider,
  useRTCClient,
  useJoin,
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

  const screenClientRef = useRef<IAgoraRTCClient | null>(null);
  const screenTrackRef = useRef<ReturnType<typeof AgoraRTC.createScreenVideoTrack> | null>(null);

  const isPublisher = role === 'host'; // host/co-host/speaker -> 'host' role from token
  const showCamera = isHost || isCoHost; // Only host/co-host get camera
  const showMic = isPublisher; // host/co-host/speaker get mic

  // Set client role
  useEffect(() => {
    client.setClientRole(role).catch((err) => {
      console.error('[WorkshopVideo] setClientRole error:', err);
    });
  }, [client, role]);

  // Join channel
  const { isConnected, isLoading: joinLoading, error: joinError } = useJoin(
    {
      appid: appId,
      channel: channelName,
      token: token,
      uid: uid,
    },
    true,
    client
  );

  // Set connection error from join
  useEffect(() => {
    if (joinError) {
      setConnectionError(joinError.message || 'Failed to connect to video');
    }
  }, [joinError]);

  // Local tracks (only create if publisher)
  const { localMicrophoneTrack, isLoading: micLoading } = useLocalMicrophoneTrack(
    isPublisher && showMic
  );
  const { localCameraTrack, isLoading: cameraLoading } = useLocalCameraTrack(
    isPublisher && showCamera
  );

  // Build publish tracks array
  const publishTracks = useMemo(() => {
    const tracks: (ICameraVideoTrack | IMicrophoneAudioTrack | null)[] = [];
    if (showCamera) tracks.push(localCameraTrack ?? null);
    if (showMic) tracks.push(localMicrophoneTrack ?? null);
    return tracks;
  }, [localCameraTrack, localMicrophoneTrack, showCamera, showMic]);

  // Publish local tracks
  usePublish(publishTracks, isPublisher && isConnected, client);

  // Remote users
  const remoteUsers = useRemoteUsers(client);

  // Connection state
  const connectionState = useConnectionState(client);

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

        // Fetch separate token for screen share UID
        const tokenRes = await fetch(
          `/api/workshops/${channelName.replace('workshop_', '')}/token?uid=${screenUid}`,
          { credentials: 'include' }
        );
        let screenToken = token; // Fallback to same token
        if (tokenRes.ok) {
          const tokenJson = await tokenRes.json();
          const tokenData = tokenJson.data ?? tokenJson;
          screenToken = tokenData.token || token;
        }

        await screenClient.join(appId, channelName, screenToken, screenUid);

        const screenTrack = await AgoraRTC.createScreenVideoTrack(
          { encoderConfig: '1080p_2' },
          'disable'
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

  // Total video feeds = local (if publisher+camera) + remote users
  const videoCount = (isPublisher && showCamera ? 1 : 0) + remoteUsers.length;

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

      {/* Video grid */}
      <div
        className={cn(
          'flex-1 grid gap-1 p-1',
          videoCount <= 1 && 'grid-cols-1 grid-rows-1',
          videoCount === 2 && 'grid-cols-2 grid-rows-1',
          videoCount >= 3 && videoCount <= 4 && 'grid-cols-2 grid-rows-2',
          videoCount >= 5 && 'grid-cols-3 grid-rows-2'
        )}
      >
        {/* Local video (host/co-host with camera) */}
        {isPublisher && showCamera && localCameraTrack && (
          <div className="relative overflow-hidden rounded-lg bg-gray-800">
            <LocalVideoTrack
              track={localCameraTrack}
              play
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
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
          <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-gray-800">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Mic className="h-8 w-8 text-primary" />
              </div>
              <p className="mt-2 text-xs text-white/60">You (audio only)</p>
            </div>
            <VideoOverlay
              name="You"
              isMuted={!micEnabled}
            />
          </div>
        )}

        {/* Remote user videos */}
        {remoteUsers.map((user) => {
          const attendee = attendees.find((a) => a.userId === Number(user.uid));
          const isScreenShare = Number(user.uid) > 100000;
          const displayName = isScreenShare
            ? 'Screen Share'
            : attendee?.displayName || `User ${user.uid}`;

          return (
            <div key={user.uid} className="relative overflow-hidden rounded-lg bg-gray-800">
              <RemoteUser
                user={user}
                playVideo
                playAudio
                style={{ width: '100%', height: '100%', objectFit: isScreenShare ? 'contain' : 'cover' }}
              />
              <VideoOverlay
                name={displayName}
                isMuted={false}
                isHost={attendee?.isHost}
                isCoHost={attendee?.isCoHost}
                isScreenShare={isScreenShare}
              />
            </div>
          );
        })}

        {/* No video feeds — audience with no publishers */}
        {videoCount === 0 && (
          <div className="flex items-center justify-center rounded-lg bg-gray-800/50">
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

      {/* Controls bar */}
      <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 px-4 py-3">
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
