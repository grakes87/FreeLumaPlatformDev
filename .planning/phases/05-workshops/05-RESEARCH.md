# Phase 5: Workshops - Research

**Researched:** 2026-02-14
**Domain:** Live video workshop infrastructure (Agora WebRTC + Socket.IO + Cloud Recording)
**Confidence:** MEDIUM (Agora SDK well-documented; integration patterns need validation)

## Summary

This phase adds live video workshop infrastructure using Agora Interactive Live Streaming for WebRTC, the existing Socket.IO system for signaling/chat/presence, and Agora Cloud Recording for automatic recording to Backblaze B2. The standard approach is a "broadcast" model where hosts/co-hosts publish video and attendees are audience-only (audio on raise-hand approval). This maps directly to Agora's `mode: "live"` with host/audience roles, which is both cheaper and more scalable than full video calling mode.

The key architectural insight is that Agora handles ONLY the media plane (video/audio streaming + recording), while the existing Socket.IO infrastructure handles ALL signaling (raise hand, workshop state, presence, in-room chat, host controls). This avoids adding Agora RTM SDK as a dependency and leverages the battle-tested Socket.IO system already in production. Workshop state management (lifecycle, RSVP, scheduling, recurrence) lives entirely in the platform's own database and API layer.

**Primary recommendation:** Use `agora-rtc-react` v2.5.x (which bundles `agora-rtc-sdk-ng` v4.x internally) for the client-side media layer, a new `/workshop` Socket.IO namespace for workshop-specific signaling, Agora Cloud Recording REST API for auto-recording, and the `rrule` npm package for recurring event generation.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `agora-rtc-react` | ^2.5.1 | React SDK for Agora WebRTC | Official React wrapper; bundles agora-rtc-sdk-ng internally; provides AgoraRTCProvider, hooks (useJoin, useLocalCameraTrack, useLocalMicrophoneTrack, usePublish, useRemoteUsers), and AgoraRTCScreenShareProvider for screen sharing |
| `agora-token` | latest | Server-side Agora RTC token generation | Official package for generating time-limited RTC tokens with role-based privileges (RolePublisher, RoleSubscriber) |
| `rrule` | ^2.8.1 | iCalendar RRULE recurrence pattern library | Standard for recurring event generation; supports FREQ, INTERVAL, BYDAY, COUNT, UNTIL; generates occurrence dates with `.all()` and `.between()` |
| `socket.io` | ^4.8.3 | Workshop signaling (raise hand, state, chat, presence) | Already installed and operational; new `/workshop` namespace follows established pattern |

### Supporting (Already Installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node-cron` | ^3.0.3 | RSVP reminder scheduling, no-show auto-cancel | 1h and 15min pre-workshop reminders; 15min no-show auto-cancel |
| `@aws-sdk/client-s3` | ^3.988.0 | B2 storage for recordings | Download recordings from Agora Cloud Recording output |
| `date-fns` / `date-fns-tz` | ^4.1.0 / ^3.2.0 | Timezone-aware scheduling | Workshop times displayed in user's local timezone |
| `zod` | ^4.3.6 | Workshop creation/edit validation | Validate title, description, schedule, capacity, recurrence |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.IO for signaling | Agora RTM SDK | Adds another SDK + cost; Socket.IO already handles presence/chat/notifications; RTM only needed for peer-to-peer messaging which we don't need (we use rooms) |
| `rrule` for recurrence | Custom ENUM (daily/weekly/monthly) | RRULE is the iCalendar standard; handles edge cases (5th Monday, biweekly, etc.); future-proof for complex patterns |
| Agora Cloud Recording | On-premise recording | Cloud Recording is fully managed; no server FFmpeg needed; composites screen share automatically; stores to B2 via S3-compatible API |
| `agora-rtc-react` | Raw `agora-rtc-sdk-ng` | React wrapper provides hooks that handle lifecycle cleanup, SSR safety, and proper React integration; no reason to use raw SDK |

### Installation

```bash
npm install agora-rtc-react agora-token rrule
npm install --save-dev @types/agora-token
```

**Environment Variables Required:**
```env
AGORA_APP_ID=<from Agora Console>
AGORA_APP_CERTIFICATE=<from Agora Console>
AGORA_CUSTOMER_ID=<for Cloud Recording REST API>
AGORA_CUSTOMER_SECRET=<for Cloud Recording REST API>
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (app)/
│   │   └── workshops/
│   │       ├── page.tsx                   # Workshop schedule/browse
│   │       ├── create/
│   │       │   └── page.tsx               # Create workshop form
│   │       ├── [id]/
│   │       │   ├── page.tsx               # Workshop detail/RSVP
│   │       │   ├── live/
│   │       │   │   └── page.tsx           # Live workshop room (Agora + chat)
│   │       │   └── edit/
│   │       │       └── page.tsx           # Edit workshop
│   │       └── series/
│   │           └── [seriesId]/
│   │               └── page.tsx           # Series overview
│   ├── api/
│   │   └── workshops/
│   │       ├── route.ts                   # GET list, POST create
│   │       ├── [id]/
│   │       │   ├── route.ts               # GET detail, PUT update, DELETE cancel
│   │       │   ├── rsvp/
│   │       │   │   └── route.ts           # POST RSVP, DELETE un-RSVP
│   │       │   ├── start/
│   │       │   │   └── route.ts           # POST start workshop (host only)
│   │       │   ├── end/
│   │       │   │   └── route.ts           # POST end workshop (host only)
│   │       │   ├── token/
│   │       │   │   └── route.ts           # GET Agora RTC token
│   │       │   ├── attendees/
│   │       │   │   ├── route.ts           # GET attendee list
│   │       │   │   └── [userId]/
│   │       │   │       └── route.ts       # PUT manage (mute/remove/promote)
│   │       │   ├── notes/
│   │       │   │   └── route.ts           # GET/PUT personal notes
│   │       │   ├── invite/
│   │       │   │   └── route.ts           # POST invite users
│   │       │   └── chat/
│   │       │       └── route.ts           # GET chat history for replay
│   │       ├── categories/
│   │       │   └── route.ts               # GET categories (admin CRUD)
│   │       ├── series/
│   │       │   └── route.ts               # POST create series
│   │       └── recording-callback/
│   │           └── route.ts               # POST Agora Cloud Recording webhook
├── components/
│   └── workshop/
│       ├── WorkshopCard.tsx               # Schedule card
│       ├── WorkshopDetail.tsx             # Detail view with RSVP
│       ├── WorkshopRoom.tsx               # Live room container
│       ├── WorkshopVideo.tsx              # Agora video grid (host + co-hosts)
│       ├── WorkshopChat.tsx               # In-room chat sidebar
│       ├── WorkshopParticipants.tsx        # Attendee list with raise hand
│       ├── WorkshopControls.tsx           # Host controls (mute, remove, end)
│       ├── WorkshopLobby.tsx              # Pre-join waiting room
│       ├── WorkshopNotes.tsx              # Personal notes panel
│       ├── WorkshopSummary.tsx            # Post-workshop summary
│       ├── ChatReplay.tsx                 # Time-synced chat sidebar for recordings
│       ├── CreateWorkshopForm.tsx         # Workshop creation form
│       └── HostDashboard.tsx              # Analytics dashboard
├── hooks/
│   ├── useWorkshopSocket.ts              # Workshop Socket.IO connection
│   ├── useWorkshopState.ts               # Workshop lifecycle state machine
│   └── useWorkshopChat.ts                # In-room chat messages
├── lib/
│   ├── workshop/
│   │   ├── agora-token.ts                # Server-side token generation
│   │   ├── cloud-recording.ts            # Cloud Recording REST API wrapper
│   │   ├── recurrence.ts                 # RRULE helpers for series
│   │   └── reminders.ts                  # RSVP reminder cron logic
│   ├── socket/
│   │   └── workshop.ts                   # /workshop namespace handlers
│   └── db/
│       └── models/
│           ├── Workshop.ts
│           ├── WorkshopSeries.ts
│           ├── WorkshopCategory.ts
│           ├── WorkshopAttendee.ts
│           ├── WorkshopChat.ts
│           ├── WorkshopNote.ts
│           └── WorkshopInvite.ts
```

### Pattern 1: Agora Interactive Live Streaming with Host/Audience Roles

**What:** Use Agora's `mode: "live"` with explicit host/audience role assignment. Hosts and co-hosts publish video+audio as broadcasters; attendees join as audience (receive-only). Role switching happens via `setClientRole()` when host approves raise-hand.

**When to use:** Always for workshop rooms. Never use `mode: "rtc"` (all-hosts mode) as it's more expensive and doesn't scale to 500+ users.

**Example:**

```typescript
// Client-side: Workshop room with Agora live streaming
'use client';
import dynamic from 'next/dynamic';

// CRITICAL: Dynamic import with ssr:false to avoid "window is not defined"
const WorkshopRoom = dynamic(() => import('@/components/workshop/WorkshopRoom'), {
  ssr: false,
  loading: () => <WorkshopLobbyLoader />,
});

export default function WorkshopLivePage({ params }: { params: { id: string } }) {
  return <WorkshopRoom workshopId={params.id} />;
}
```

```typescript
// WorkshopRoom.tsx - Agora client setup
import AgoraRTC, { AgoraRTCProvider } from 'agora-rtc-react';
import { useState, useMemo } from 'react';

export default function WorkshopRoom({ workshopId }: { workshopId: string }) {
  // Create client with "live" mode for broadcast streaming
  const client = useMemo(
    () => AgoraRTC.createClient({ mode: 'live', codec: 'vp8' }),
    []
  );

  return (
    <AgoraRTCProvider client={client}>
      <WorkshopVideoArea workshopId={workshopId} />
    </AgoraRTCProvider>
  );
}
```

### Pattern 2: Socket.IO Workshop Namespace for Signaling

**What:** New `/workshop` Socket.IO namespace handles all workshop signaling: raise hand, host controls, workshop state changes, in-room chat, attendee presence. This avoids adding Agora RTM SDK.

**When to use:** All workshop real-time features that aren't media streaming.

**Example:**

```typescript
// Server: src/lib/socket/workshop.ts
import type { Namespace, Socket } from 'socket.io';

export function registerWorkshopHandlers(nsp: Namespace, socket: Socket): void {
  const userId = socket.data.userId as number;

  // Join workshop room
  socket.on('workshop:join', async ({ workshopId }: { workshopId: number }) => {
    // Validate user is RSVP'd or host
    socket.join(`workshop:${workshopId}`);
    nsp.to(`workshop:${workshopId}`).emit('workshop:user-joined', { userId });
  });

  // Raise hand request (attendee -> host)
  socket.on('workshop:raise-hand', async ({ workshopId }: { workshopId: number }) => {
    nsp.to(`workshop:${workshopId}`).emit('workshop:hand-raised', { userId });
  });

  // Host approves speaker (host -> specific attendee)
  socket.on('workshop:approve-speaker', async ({ workshopId, targetUserId }: { workshopId: number; targetUserId: number }) => {
    // Validate caller is host/co-host
    nsp.to(`workshop:${workshopId}`).emit('workshop:speaker-approved', { userId: targetUserId });
  });

  // In-room chat message
  socket.on('workshop:chat', async ({ workshopId, message }: { workshopId: number; message: string }) => {
    // Save to WorkshopChat table with timestamp offset from workshop start
    nsp.to(`workshop:${workshopId}`).emit('workshop:chat-message', {
      userId,
      message,
      timestamp: Date.now(),
    });
  });
}
```

### Pattern 3: Agora Token Generation (Server-Side)

**What:** Generate time-limited RTC tokens on the server for each user joining a workshop. Token encodes the user's role (publisher for hosts, subscriber for audience).

**When to use:** Every time a user joins a workshop room. Tokens should be short-lived (1 hour max, with renewal).

**Example:**

```typescript
// src/lib/workshop/agora-token.ts
import { RtcTokenBuilder, RtcRole } from 'agora-token';

const APP_ID = process.env.AGORA_APP_ID!;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE!;

export function generateAgoraToken(
  channelName: string,
  uid: number,
  role: 'host' | 'audience'
): string {
  const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const tokenExpire = 3600; // 1 hour
  const privilegeExpire = 3600;

  return RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    agoraRole,
    tokenExpire,
    privilegeExpire
  );
}
```

### Pattern 4: Cloud Recording Lifecycle

**What:** Agora Cloud Recording is triggered server-side via REST API when host starts a workshop. Recording uploads to B2 via S3-compatible storage. Webhook callback notifies when recording is ready.

**When to use:** Automatically on every workshop start. Host cannot disable recording.

**Example:**

```typescript
// src/lib/workshop/cloud-recording.ts
const AGORA_BASE_URL = 'https://api.agora.io/v1/apps';

interface RecordingSession {
  resourceId: string;
  sid: string;
}

export async function startCloudRecording(
  channelName: string,
  recordingUid: number, // Must be unique, not matching any participant
  token: string
): Promise<RecordingSession> {
  const appId = process.env.AGORA_APP_ID!;
  const authHeader = `Basic ${Buffer.from(
    `${process.env.AGORA_CUSTOMER_ID}:${process.env.AGORA_CUSTOMER_SECRET}`
  ).toString('base64')}`;

  // Step 1: Acquire resource
  const acquireRes = await fetch(
    `${AGORA_BASE_URL}/${appId}/cloud_recording/acquire`,
    {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cname: channelName,
        uid: String(recordingUid),
        clientRequest: {},
      }),
    }
  );
  const { resourceId } = await acquireRes.json();

  // Step 2: Start recording (composite mode)
  const startRes = await fetch(
    `${AGORA_BASE_URL}/${appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
    {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cname: channelName,
        uid: String(recordingUid),
        clientRequest: {
          token,
          recordingConfig: {
            channelType: 1, // 1 = live broadcast
            streamTypes: 2, // audio + video
            maxIdleTime: 300, // 5 min idle timeout
            transcodingConfig: {
              width: 1280,
              height: 720,
              fps: 30,
              bitrate: 1500,
              mixedVideoLayout: 1, // Best fit layout
            },
          },
          recordingFileConfig: {
            avFileType: ['hls', 'mp4'],
          },
          storageConfig: {
            vendor: 11, // S3-compatible (Backblaze B2)
            region: 0,
            bucket: process.env.B2_BUCKET_NAME!,
            accessKey: process.env.B2_KEY_ID!,
            secretKey: process.env.B2_APP_KEY!,
            fileNamePrefix: ['workshop-recordings'],
            extensionParams: {
              sse: 'none',
              tag: 'workshop',
              endpoint: `https://s3.${process.env.B2_REGION}.backblazeb2.com`,
            },
          },
        },
      }),
    }
  );
  const { sid } = await startRes.json();

  return { resourceId, sid };
}
```

### Pattern 5: Workshop Lifecycle State Machine

**What:** Workshop goes through defined states: `scheduled` -> `lobby` -> `live` -> `ended`. State transitions are managed server-side and broadcast via Socket.IO.

**When to use:** All workshop state management.

```
States:
  scheduled -> lobby      (host opens room, 15 min before start)
  lobby     -> live        (host clicks "Start Workshop")
  live      -> ended       (host clicks "End Workshop")
  scheduled -> cancelled   (host cancels or 15-min no-show)
```

### Pattern 6: Recurring Workshop Series with RRULE

**What:** Store recurrence pattern as RRULE string on WorkshopSeries. Generate individual Workshop instances on series creation (30-90 day horizon). Each instance has its own attendees, chat, and recording.

**When to use:** When host creates a recurring workshop.

**Example:**

```typescript
// src/lib/workshop/recurrence.ts
import { RRule } from 'rrule';

export function generateInstances(
  rruleString: string,
  startDate: Date,
  horizonDays: number = 90
): Date[] {
  const rule = RRule.fromString(rruleString);
  const until = new Date(startDate);
  until.setDate(until.getDate() + horizonDays);

  return rule.between(startDate, until, true);
}

// Example: Weekly on Mondays at 7pm
// RRULE:FREQ=WEEKLY;BYDAY=MO
```

### Pattern 7: Lobby/Waiting Room (Application-Level)

**What:** Lobby is implemented at the application level, not via Agora. Users connect to the Socket.IO workshop room first. The page shows a waiting room UI. Only when the host clicks "Start," the server broadcasts the `workshop:started` event, and clients then join the Agora channel. This avoids Agora billing for lobby wait time.

**When to use:** Always. Attendees should not join the Agora channel until the workshop transitions to `live`.

### Anti-Patterns to Avoid

- **Using `mode: "rtc"` for workshops:** All users become hosts. Costs 2-4x more and doesn't support 500+ attendees efficiently. Always use `mode: "live"`.
- **Importing Agora SDK at top level in Next.js:** Causes "window is not defined" SSR error. Always use `next/dynamic` with `ssr: false` or dynamic `import()` in `useEffect`.
- **Using Agora RTM for signaling:** Adds unnecessary SDK, complexity, and cost when Socket.IO already handles all signaling needs.
- **Creating a single Agora client for both camera and screen share:** Screen sharing requires a separate client instance. Use `AgoraRTCScreenShareProvider` with its own client.
- **Storing individual recurring event instances as separate rows upfront:** Store RRULE pattern + generate instances on a rolling 90-day horizon. Expand lazily.
- **Joining Agora channel during lobby/waiting phase:** Wastes billing minutes. Only join when workshop state transitions to `live`.
- **Generating Agora tokens on the client:** Never expose App Certificate to the browser. Tokens must be generated server-side.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebRTC media streaming | Custom WebRTC with STUN/TURN | Agora Interactive Live Streaming SDK | WebRTC is notoriously complex; TURN servers, codec negotiation, SFU routing, bandwidth adaptation are all handled |
| Video recording & compositing | FFmpeg server recording | Agora Cloud Recording (REST API) | Composites multiple streams + screen share automatically; uploads to cloud storage; no server CPU cost |
| RTC token generation | Custom JWT-like tokens | `agora-token` npm package (RtcTokenBuilder) | Agora-specific token format with role privileges; must match SDK expectations exactly |
| Recurring event calculation | Custom day/week/month logic | `rrule` npm package | iCalendar RFC 5545 standard; handles timezone edge cases, DST transitions, nth-weekday patterns |
| Screen share compositing in recording | Post-processing with FFmpeg | Agora Cloud Recording composite mode | Auto-composites screen share with speaker video into single recording stream |
| WebRTC role management | Custom publish/subscribe logic | Agora `setClientRole()` | Native SDK method handles bandwidth optimization for audience vs host |
| Audio level detection | Custom AudioContext analysis | Agora `useVolumeLevel()` hook | Built into agora-rtc-react; handles browser differences |

**Key insight:** The complexity of this phase is in the integration and state management, not in the individual technologies. Agora handles all media complexity. Socket.IO handles all signaling. The work is connecting them properly with a clean state machine and database schema.

## Common Pitfalls

### Pitfall 1: "window is not defined" SSR Error
**What goes wrong:** Agora SDK accesses `window` and `navigator` objects on import. Next.js server-side rendering crashes because these don't exist in Node.js.
**Why it happens:** agora-rtc-sdk-ng includes WebRTC polyfill code that runs at import time.
**How to avoid:** Always use `next/dynamic` with `ssr: false` for any component that imports Agora. Never import agora-rtc-react at the top level of a page component.
**Warning signs:** Build errors or runtime crashes mentioning `window`, `navigator`, or `RTCPeerConnection`.

### Pitfall 2: Role Switch Requires Unpublish First
**What goes wrong:** Calling `setClientRole("audience")` while still publishing throws an exception.
**Why it happens:** Agora requires tracks to be unpublished before switching from host to audience role.
**How to avoid:** Always call `client.unpublish()` before `client.setClientRole("audience")`. For raise-hand demotion: unpublish audio track, then set role.
**Warning signs:** Console errors about role switching or tracks still published.

### Pitfall 3: Cloud Recording UID Collision
**What goes wrong:** Cloud Recording fails to join channel because its UID matches an existing participant.
**Why it happens:** The recording bot joins as a user in the channel and needs a unique UID.
**How to avoid:** Use a dedicated UID range for recording bots (e.g., 900000 + workshopId). Ensure this UID never collides with user IDs.
**Warning signs:** Cloud Recording acquire/start API returns error about UID conflict.

### Pitfall 4: Screen Share Requires Separate Client
**What goes wrong:** Publishing screen share track replaces the camera video track on the same client.
**Why it happens:** Agora allows only one video track per client. Camera and screen share are both video tracks.
**How to avoid:** Create a second Agora client instance for screen sharing. Use `AgoraRTCScreenShareProvider` with its own client. The screen share client also joins the same channel with a different UID (e.g., user's UID + 100000).
**Warning signs:** Camera feed disappears when screen sharing starts.

### Pitfall 5: Cloud Recording Resource ID Expires in 5 Minutes
**What goes wrong:** Recording fails to start because the resource ID expired before `start` was called.
**Why it happens:** The `acquire` call returns a resource ID valid for only 5 minutes.
**How to avoid:** Call `acquire` and `start` in immediate sequence (same API handler). Don't acquire resources in advance.
**Warning signs:** Start recording API returns 404 or invalid resource error.

### Pitfall 6: Agora Billing for Audience in Live Mode
**What goes wrong:** Costs are higher than expected because audience members subscribing to HD video are billed at HD rates.
**Why it happens:** Agora bills per subscriber-minute at the resolution tier being subscribed to.
**How to avoid:** Use Broadcast Streaming pricing tier (audience costs ~50% less than host-mode). Cap video resolution at 720p for workshops. Monitor usage in Agora Console.
**Warning signs:** Unexpectedly high bills. Check Agora Console usage dashboard.

### Pitfall 7: Chat Messages Not Time-Synced for Replay
**What goes wrong:** Chat replay doesn't align with recording playback position.
**Why it happens:** Chat timestamps are absolute (wall clock) but recording playback is relative (0:00 to duration).
**How to avoid:** Store chat messages with `offset_ms` (milliseconds from workshop start time). On replay, show messages whose `offset_ms <= current playback position`.
**Warning signs:** Chat messages appear at wrong times during recording playback.

### Pitfall 8: RRULE Timezone Issues
**What goes wrong:** Recurring workshop instances show at wrong times for users in different timezones.
**Why it happens:** RRULE generates dates in UTC by default. If the host schedules "Every Monday at 7pm EST," naive UTC conversion shifts across DST boundaries.
**How to avoid:** Store the host's intended timezone alongside the RRULE. Generate instances using `date-fns-tz` to convert from host timezone to UTC for storage. Display in viewer's local timezone.
**Warning signs:** Workshop times shift by 1 hour around DST transitions.

### Pitfall 9: No-Show Auto-Cancel Race Condition
**What goes wrong:** Workshop auto-cancels at +15 minutes even though host started at +14 minutes.
**Why it happens:** Cron job and host start action race without proper state locking.
**How to avoid:** Use database transaction with status check: only cancel if status is still `scheduled` (not `lobby` or `live`). The start action transitions to `lobby`/`live` first.
**Warning signs:** Host reports workshop was cancelled even though they started it.

## Code Examples

### Agora Client Initialization for Live Workshop

```typescript
// Source: Agora Web SDK docs + agora-rtc-react README
'use client';
import AgoraRTC, {
  AgoraRTCProvider,
  useJoin,
  useLocalMicrophoneTrack,
  useLocalCameraTrack,
  usePublish,
  useRemoteUsers,
  useRemoteVideoTracks,
  useConnectionState,
  LocalVideoTrack,
  RemoteUser,
} from 'agora-rtc-react';
import { useState, useEffect, useMemo } from 'react';

interface WorkshopVideoProps {
  workshopId: number;
  channelName: string;
  token: string;
  uid: number;
  isHost: boolean;
}

function WorkshopVideoInner({ channelName, token, uid, isHost }: WorkshopVideoProps) {
  const client = useMemo(
    () => AgoraRTC.createClient({ mode: 'live', codec: 'vp8' }),
    []
  );

  // Set role before joining
  useEffect(() => {
    client.setClientRole(isHost ? 'host' : 'audience');
  }, [client, isHost]);

  // Join channel
  useJoin({
    appid: process.env.NEXT_PUBLIC_AGORA_APP_ID!,
    channel: channelName,
    token,
    uid,
  });

  // Local tracks (only for hosts)
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(isHost);
  const { localCameraTrack } = useLocalCameraTrack(isHost);

  // Publish local tracks (only for hosts)
  usePublish([localMicrophoneTrack, localCameraTrack]);

  // Remote users (hosts/co-hosts publishing video)
  const remoteUsers = useRemoteUsers();
  const { videoTracks } = useRemoteVideoTracks(remoteUsers);

  const connectionState = useConnectionState();

  return (
    <div className="workshop-video-grid">
      {/* Local video (host only) */}
      {isHost && localCameraTrack && (
        <LocalVideoTrack track={localCameraTrack} play />
      )}
      {/* Remote videos (other hosts/co-hosts) */}
      {remoteUsers.map((user) => (
        <RemoteUser key={user.uid} user={user} playVideo playAudio />
      ))}
    </div>
  );
}
```

### Server-Side Token Endpoint

```typescript
// Source: Agora token docs
// src/app/api/workshops/[id]/token/route.ts
import { withAuth } from '@/lib/auth/middleware';
import { generateAgoraToken } from '@/lib/workshop/agora-token';

export const GET = withAuth(async (req, { user, params }) => {
  const workshopId = Number(params.id);

  // Verify workshop exists and user is RSVP'd or host
  const { Workshop, WorkshopAttendee } = await import('@/lib/db/models');
  const workshop = await Workshop.findByPk(workshopId);
  if (!workshop) {
    return Response.json({ error: 'Workshop not found' }, { status: 404 });
  }

  const isHost = workshop.host_id === user.id;
  const isCoHost = false; // Check co-host status
  const isAttendee = await WorkshopAttendee.findOne({
    where: { workshop_id: workshopId, user_id: user.id },
  });

  if (!isHost && !isCoHost && !isAttendee) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }

  const channelName = `workshop-${workshopId}`;
  const role = isHost || isCoHost ? 'host' : 'audience';
  const token = generateAgoraToken(channelName, user.id, role);

  return Response.json({ token, channelName, uid: user.id, role });
});
```

### Workshop Database Schema (Key Tables)

```typescript
// Workshop model fields
{
  id: INTEGER PRIMARY KEY AUTO_INCREMENT,
  series_id: INTEGER NULLABLE REFERENCES workshop_series(id),
  host_id: INTEGER NOT NULL REFERENCES users(id),
  category_id: INTEGER REFERENCES workshop_categories(id),
  title: STRING(200) NOT NULL,
  description: TEXT,
  scheduled_at: DATE NOT NULL,
  duration_minutes: INTEGER, // estimated, not enforced
  actual_started_at: DATE NULLABLE,
  actual_ended_at: DATE NULLABLE,
  status: ENUM('scheduled', 'lobby', 'live', 'ended', 'cancelled') DEFAULT 'scheduled',
  is_private: BOOLEAN DEFAULT false,
  max_capacity: INTEGER NULLABLE, // null = unlimited
  recording_url: STRING(500) NULLABLE,
  recording_sid: STRING(100) NULLABLE, // Agora recording session ID
  recording_resource_id: STRING(200) NULLABLE,
  agora_channel: STRING(100), // generated: workshop-{id}
  attendee_count: INTEGER DEFAULT 0, // denormalized
  created_at: DATE,
  updated_at: DATE,
}

// WorkshopSeries model fields
{
  id: INTEGER PRIMARY KEY AUTO_INCREMENT,
  host_id: INTEGER NOT NULL REFERENCES users(id),
  category_id: INTEGER REFERENCES workshop_categories(id),
  title: STRING(200) NOT NULL,
  description: TEXT,
  rrule: STRING(500) NOT NULL, // e.g. "FREQ=WEEKLY;BYDAY=MO"
  time_of_day: TIME NOT NULL, // e.g. "19:00:00"
  timezone: STRING(50) NOT NULL, // e.g. "America/New_York"
  duration_minutes: INTEGER,
  is_active: BOOLEAN DEFAULT true,
  created_at: DATE,
  updated_at: DATE,
}

// WorkshopAttendee model fields
{
  id: INTEGER PRIMARY KEY AUTO_INCREMENT,
  workshop_id: INTEGER NOT NULL REFERENCES workshops(id),
  user_id: INTEGER NOT NULL REFERENCES users(id),
  status: ENUM('rsvp', 'joined', 'left') DEFAULT 'rsvp',
  joined_at: DATE NULLABLE,
  left_at: DATE NULLABLE,
  is_co_host: BOOLEAN DEFAULT false,
  can_speak: BOOLEAN DEFAULT false, // raise hand approved
  // UNIQUE(workshop_id, user_id)
  created_at: DATE,
  updated_at: DATE,
}

// WorkshopChat model fields
{
  id: INTEGER PRIMARY KEY AUTO_INCREMENT,
  workshop_id: INTEGER NOT NULL REFERENCES workshops(id),
  user_id: INTEGER NOT NULL REFERENCES users(id),
  message: TEXT NOT NULL,
  offset_ms: INTEGER NOT NULL, // ms from workshop actual_started_at
  created_at: DATE,
}

// WorkshopNote model fields
{
  id: INTEGER PRIMARY KEY AUTO_INCREMENT,
  workshop_id: INTEGER NOT NULL REFERENCES workshops(id),
  user_id: INTEGER NOT NULL REFERENCES users(id),
  content: TEXT,
  // UNIQUE(workshop_id, user_id)
  created_at: DATE,
  updated_at: DATE,
}
```

### Chat Replay Component Pattern

```typescript
// Time-synced chat replay alongside recording playback
// Source: Twitch/YouTube chat replay pattern (application-level)
interface ChatReplayProps {
  messages: WorkshopChatMessage[];
  currentTimeMs: number; // Current video playback position in ms
}

function ChatReplay({ messages, currentTimeMs }: ChatReplayProps) {
  // Filter messages that should be visible at current playback position
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.offset_ms <= currentTimeMs),
    [messages, currentTimeMs]
  );

  // Auto-scroll to latest visible message
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length]);

  return (
    <div className="chat-replay-sidebar overflow-y-auto">
      {visibleMessages.map((msg) => (
        <div key={msg.id} className="chat-message">
          <span className="text-xs text-gray-400">
            {formatDuration(msg.offset_ms)}
          </span>
          <span className="font-medium">{msg.username}</span>
          <span>{msg.message}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agora Web SDK 3.x (agora-rtc-sdk) | Agora Web SDK 4.x (agora-rtc-sdk-ng) | 2020 | Complete API redesign; NG uses promises, tracks-based API, better TypeScript support |
| agora-access-token npm | agora-token npm | 2023 | Old package deprecated; new package supports AccessToken2 with fine-grained privileges |
| Manual Agora React integration | agora-rtc-react v2.x | 2024 | Official React SDK with hooks; bundles agora-rtc-sdk-ng internally (no separate install) |
| Agora RTM for all signaling | RTM only for pure P2P; Socket.IO for app-integrated signaling | Ongoing | Apps with existing WebSocket infrastructure don't need RTM's additional cost/complexity |
| On-premise recording (server FFmpeg) | Cloud Recording REST API | 2020+ | Fully managed; no server resources needed; auto-compositing |

**Deprecated/outdated:**
- `agora-rtc-sdk` (v3): Replaced by `agora-rtc-sdk-ng` (v4.x). Do not use.
- `agora-access-token`: Deprecated in favor of `agora-token`.
- `AgoraRTC.createClient({ mode: "rtc" })` for live streaming: Works but wastes money. Use `mode: "live"` for broadcast scenarios.

## Open Questions

Things that could not be fully resolved:

1. **Backblaze B2 Compatibility with Agora Cloud Recording vendor=11**
   - What we know: Agora supports S3-compatible storage (vendor=11) with custom endpoint. B2 provides S3-compatible API at `s3.<region>.backblazeb2.com`.
   - What's unclear: Whether Agora Cloud Recording has been tested/validated with Backblaze B2 specifically. The official docs don't list B2 among verified vendors.
   - Recommendation: Test this integration early in development. If B2 doesn't work with vendor=11, fall back to Amazon S3 for recording storage and copy to B2 post-recording. **Confidence: LOW** -- this is the highest-risk technical unknown.

2. **Agora Free Tier Adequacy for 500+ Attendee Workshops**
   - What we know: Free tier gives 10,000 Standard minutes/month for RTC and 10,000 for Cloud Recording. A single 1-hour workshop with 500 audience members at HD video = 500 x 60 = 30,000 subscriber-minutes (at audience HD rate: 1:2 conversion = 15,000 Standard minutes). This EXCEEDS the free tier in a single workshop.
   - What's unclear: Whether the platform expects to run this many large workshops or if most will be smaller (10-50 attendees).
   - Recommendation: Start with free tier. A 1-hour workshop with 50 attendees at 720p = ~3,000 Standard minutes. Budget for Starter package ($45.99/mo for 50,000 minutes) if workshops are popular. Agora costs scale linearly with audience size. **Confidence: HIGH** -- pricing docs are clear.

3. **Cloud Recording MP4 vs HLS Availability Timing**
   - What we know: Setting `avFileType: ["hls", "mp4"]` generates both formats. HLS (M3U8 + TS segments) is available during recording. MP4 is generated after recording stops.
   - What's unclear: Exact latency for MP4 file to be available after workshop ends. Agora says "near-instant" but this could mean 1-15 minutes depending on duration.
   - Recommendation: Use the HLS manifest for immediate playback. Generate/use MP4 for the video library entry. Poll recording status via Agora query API or wait for webhook callback. **Confidence: MEDIUM**

4. **Workshop Notes Persistence During Network Interruption**
   - What we know: Notes are personal, per-user, per-workshop.
   - What's unclear: Whether to use debounced auto-save (like Draft model) or explicit save button.
   - Recommendation: Use the existing 2s debounced auto-save pattern (same as Draft model). Store as simple TEXT field on WorkshopNote. **Confidence: HIGH** -- pattern already proven in codebase.

5. **Screen Share UID Strategy for Cloud Recording**
   - What we know: Screen share uses a separate Agora client with a different UID. Cloud Recording composites all UIDs in the channel.
   - What's unclear: Whether the screen share UID should appear as a separate "participant" in the recording layout, and how to handle layout switching when screen share starts/stops.
   - Recommendation: Use UID = user.id + 100000 for screen share client. Use Cloud Recording `updateLayout` API to switch to a custom layout when screen share starts (large screen share + small speaker PIP), and switch back to best-fit when screen share stops. The workshop backend tracks screen-share state via Socket.IO events. **Confidence: MEDIUM**

## Sources

### Primary (HIGH confidence)
- [Agora Interactive Live Streaming Pricing](https://docs.agora.io/en/interactive-live-streaming/overview/pricing) -- pricing tiers, free minutes, audience vs host rates
- [Agora Cloud Recording Composite Mode](https://docs.agora.io/en/cloud-recording/develop/composite-mode) -- recording API, storage config, composite layout
- [Agora Cloud Recording REST Quickstart](https://docs.agora.io/en/cloud-recording/get-started/getstarted) -- acquire/start/stop API flow
- [Agora Cloud Recording Webhooks](https://docs.agora.io/en/cloud-recording/develop/receive-notifications) -- callback events, fileList format
- [Agora Cloud Recording Pricing](https://docs.agora.io/en/cloud-recording/overview/pricing) -- 10K free minutes, per-tier costs
- [Agora Cloud Recording Layout](https://docs.agora.io/en/cloud-recording/develop/layout) -- floating/best-fit/vertical/custom layouts
- [Agora Cloud Recording Storage Vendors](https://docs.agora.io/en/cloud-recording/reference/region-vendor) -- vendor=11 for S3-compatible
- [Agora Token Server Deployment](https://docs.agora.io/en/voice-calling/token-authentication/deploy-token-server) -- agora-token package, RtcTokenBuilder
- [agora-rtc-react GitHub](https://github.com/AgoraIO-Extensions/agora-rtc-react) -- v2.5.1, hooks, AgoraRTCScreenShareProvider
- [Agora Web SDK API Reference v4.24.x](https://api-ref.agora.io/en/video-sdk/web/4.x/interfaces/iagorartcclient.html) -- setClientRole, join, publish, events

### Secondary (MEDIUM confidence)
- [Agora Blog: Next.js Video Call App](https://www.agora.io/en/blog/build-a-next-js-video-call-app/) -- AgoraRTCProvider pattern, hooks usage
- [Agora Blog: Raise Hand Feature](https://www.agora.io/en/blog/building-a-raise-your-hand-feature-for-live-streams-using-the-agora-web-sdk/) -- RTM-based raise hand (we adapt to Socket.IO)
- [Agora Blog: Role Switching in Live Streaming](https://www.agora.io/en/blog/changing-the-role-of-a-remote-host-in-a-live-streaming-web-app/) -- setClientRole patterns
- [rrule npm package](https://www.npmjs.com/package/rrule) -- v2.8.1, RRULE RFC 5545 implementation
- [Calendar Recurring Events Best Storage](https://www.codegenes.net/blog/calendar-recurring-repeating-events-best-storage-method/) -- hybrid RRULE + precomputed instances pattern
- [Next.js Agora SSR Discussion](https://github.com/vercel/next.js/discussions/21277) -- window is not defined workaround

### Tertiary (LOW confidence)
- Backblaze B2 + Agora Cloud Recording vendor=11 compatibility -- inferred from docs, not validated
- Agora Cloud Recording MP4 generation latency -- not precisely documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- agora-rtc-react v2.5.x and agora-token are the official, current packages
- Architecture: HIGH -- live mode with host/audience roles is the documented Agora pattern for this use case
- Socket.IO signaling: HIGH -- existing infrastructure proven across 3 phases; new namespace follows established pattern
- Cloud Recording + B2: MEDIUM -- S3-compatible vendor=11 is documented but B2 specifically is not verified
- Recurring events (rrule): HIGH -- standard iCalendar library, well-documented
- Pitfalls: HIGH -- documented in official Agora docs and community issues
- Pricing: HIGH -- official pricing page with detailed per-minute costs

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days -- Agora SDK is stable; Cloud Recording API is stable)
