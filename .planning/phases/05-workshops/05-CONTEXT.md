# Phase 5: Workshops — Context & Decisions

## Phase Goal
Live video workshop infrastructure complete — hosts can schedule and broadcast live workshops with video, attendees can join with audio-only participation (raise hand to speak, no video), and workshops support real-time chat, presence tracking, recording, and analytics.

## Decisions

### 1. Participation Model

**Format**: Video-call style — all participants *can* share camera/mic, but practical limits apply.

**Video feeds**: Only host + co-hosts have video on. Attendees are audio-only even when approved to speak. This keeps Agora costs manageable at scale.

**Raise hand**: Attendees can raise hand to request to speak. Host approves, which unmutes their audio (video stays off).

**Default state**: Attendees join muted by default. Must manually unmute (if small group) or use raise hand.

**Co-hosts**: Supported. Host can promote attendees to co-host, granting them video + moderation powers (mute, remove).

**Gallery view**: Attendees see host + co-host video feeds in gallery. Other attendees appear in a participant list (not video grid).

**Capacity**: Up to 500+ attendees per workshop.

### 2. Scheduling & Workshop Lifecycle

**Recurrence**: Recurring series supported. System auto-creates individual workshop instances from the recurrence pattern. Each instance has its own attendee list, chat history, and recording.

**Schedule range**: No limit on how far in advance workshops can be scheduled.

**Minimum lead time**: 15 minutes from now. No instant/impromptu workshops.

**RSVP cap**: No cap — unlimited RSVPs. Anyone can join.

**Pre-workshop**: Lobby/waiting room. Attendees enter a waiting room; host admits them when ready (or auto-admit on start).

**No-show handling**: Auto-cancel after 15 minutes if host doesn't start. All RSVP'd attendees notified of cancellation.

**Co-host can't start**: Only the designated host can start the workshop (co-hosts cannot substitute for absent host — workshop auto-cancels).

**Time limit**: No maximum duration. Workshop runs until host manually ends it.

**Reminders**: RSVP'd attendees receive notifications at 1 hour and 15 minutes before start.

**Edit/cancel**: Host can fully edit (reschedule, update details) or cancel at any time. All RSVP'd attendees notified of changes.

**Post-workshop**: Summary screen shown to attendees with duration, attendee count, recording link, and next session date (if recurring).

### 3. Recording & Replay

**Auto-record**: Every workshop is recorded automatically. Host cannot disable recording.

**Destination**: Recordings auto-publish to the platform's video library (public). All platform users can watch, not just RSVP'd attendees.

**Availability**: Near-instant — available within minutes after workshop ends (Agora cloud recording).

**Chat replay**: All chat messages preserved and replayed time-synced alongside the recorded video as a sidebar.

**Screen share**: When screen sharing is active, it's composited into the main recording (screen share + speaker video merged into one stream).

**Recording notification**: All RSVP'd attendees auto-notified when the recording becomes available.

### 4. Host Access & Creator Model

**Eligibility**: Any registered user can create and host workshops. No minimum requirements (no account age, follower count, or verification gate).

**Host revocation**: Admin can revoke a user's hosting privileges via a separate flag without banning them. User retains full attendee access but cannot create new workshops.

**Categories**: Admin-defined workshop categories (e.g., Bible Study, Prayer, Worship, Fellowship). Host selects a category when creating a workshop.

**Private workshops**: Hosts can create invite-only workshops visible only to invited users.

**Creator dashboard**: Full analytics — attendance trends, average watch time, ratings, top workshops, growth charts. Plus full attendee list per workshop (who attended, join/leave times, engagement data).

**Monetization**: Not in v2. No tips, donations, or paid workshops. Deferred to future version.

## Deferred Ideas
- Monetization (tips, paid workshops) — future version
- Impromptu/instant workshops (currently 15-min minimum lead time)
- Attendee video feeds (currently host + co-hosts only)
- Co-host starting in host's absence

## Technical Notes (for researcher/planner)
- Agora Web SDK for video/audio streaming
- Agora Cloud Recording for auto-record
- Socket.IO already operational (Phase 3) — reuse for workshop presence + in-room chat
- Existing video library infrastructure (Phase 4) — recordings publish as Video entries
- Existing notification system (Phase 3) — RSVP reminders + recording available notifications
- Existing category model pattern (Phase 4 VideoCategory) — adapt for WorkshopCategory
- User model already has `role` field — consider `can_host` boolean or similar for host revocation

## Open Questions (for researcher)
- Agora free tier limits vs. 500+ attendee workshops — pricing validation needed
- Agora Cloud Recording API for composited recording with screen share
- Chat replay UI pattern — time-synced sidebar with scrollable messages
- Recurring event pattern — iCal RRULE or custom recurrence model
- Lobby/waiting room UX with Agora — pre-join vs. channel-based approach
