---
phase: 03-real-time
plan: 09
subsystem: chat-voice-media
tags: [voice-recording, mediarecorder, waveform, media-attachment, audio-playback, presigned-upload]
dependency-graph:
  requires: [03-04]
  provides: [voice-recorder-hook, voice-recorder-ui, media-attachment-sheet, voice-playback]
  affects: [03-10, 03-11, 03-12]
tech-stack:
  added: []
  patterns: [mediarecorder-analysernode-waveform, mime-type-detection, presigned-upload-voice, static-waveform-playback]
key-files:
  created:
    - src/hooks/useVoiceRecorder.ts
    - src/components/chat/VoiceRecorder.tsx
    - src/components/chat/MediaAttachmentSheet.tsx
    - src/components/chat/VoicePlayback.tsx
  modified: []
decisions:
  - id: "static-waveform-playback"
    decision: "Voice playback uses static proportional bars with progress fill, not real-time AnalyserNode"
    rationale: "Standard WhatsApp approach -- analyzing actual audio requires full download/decode; static bars with left-to-right fill provides expected UX"
  - id: "deterministic-bar-heights"
    decision: "Playback bar heights generated from deterministic pseudo-random based on index and duration"
    rationale: "Consistent visual per message without needing to store or compute actual waveform data"
  - id: "voice-auto-start"
    decision: "VoiceRecorder auto-starts recording on mount via setTimeout"
    rationale: "User already tapped mic button to open recorder; immediate start matches WhatsApp UX"
metrics:
  duration: 4 min
  completed: 2026-02-13
---

# Phase 3 Plan 9: Voice Messages & Media Attachment Summary

**useVoiceRecorder hook with MediaRecorder + AnalyserNode for live waveform, VoiceRecorder UI with cancel/send/upload, MediaAttachmentSheet bottom sheet with Gallery/Camera/Voice options, and VoicePlayback component with static bar progress visualization**

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Voice recorder hook and recording UI | 87916c6 | Done |
| 2 | Media attachment sheet and voice playback | 70beeeb | Done |

## What Was Built

### useVoiceRecorder Hook

Custom hook wrapping the native MediaRecorder API with AnalyserNode for live audio visualization:

- **MIME type detection:** Tries audio/webm;codecs=opus, audio/mp4;codecs=aac, audio/webm in order with isTypeSupported checks
- **Recording lifecycle:** startRecording (getUserMedia + AudioContext + MediaRecorder), stopRecording (returns Promise<Blob|null>), cancelRecording (discards all data)
- **Waveform data:** AnalyserNode with fftSize=256, getByteFrequencyData averaged to 0-1 audioLevel via requestAnimationFrame loop
- **Duration tracking:** setInterval at 1s updates, auto-stop at 60s (MAX_DURATION_MS)
- **Chunk collection:** ondataavailable every 100ms for responsive stop behavior
- **Full cleanup:** Stops media tracks, closes AudioContext, cancels animation frame, clears intervals on unmount
- **Exports:** isRecording, duration, audioLevel, isSupported, mimeType, startRecording, stopRecording, cancelRecording

### VoiceRecorder Component

Recording UI that replaces the normal chat input area when user taps mic:

- **Layout:** [Cancel X] [8 waveform bars] [MM:SS timer] [Send button]
- **Waveform bars:** Height scales with audioLevel, center-weighted for natural look, 75ms CSS transitions
- **Cancel:** Red X button calls cancelRecording() and closes
- **Send flow:** stopRecording() -> GET presigned URL from /api/upload/chat-media -> PUT blob to B2 -> POST message to /api/chat/conversations/[id]/messages with type:voice
- **Error handling:** Microphone permission denied message, upload failures, unsupported browser fallback
- **Auto-start:** Recording begins immediately on mount (user already tapped mic to enter this mode)
- **Accessibility:** aria-labels on all buttons, role=region on container

### MediaAttachmentSheet Component

Liquid glass bottom sheet for attaching media to chat messages:

- **Three options:** Gallery (image/video file picker, multiple), Camera (capture=environment), Voice (delegates to parent's VoiceRecorder)
- **Thumbnail previews:** Horizontal scroll row with object-cover thumbnails, X remove button on each
- **Max 10 attachments:** Counter display, buttons disabled at limit
- **Upload flow:** Sequential presigned URL -> PUT for each file, then single POST message with media array
- **Sheet behavior:** createPortal to body, swipe-down dismiss, Escape key, backdrop click close
- **Send button:** Shows upload progress spinner, disabled while sending

### VoicePlayback Component

Renders voice messages inside chat bubbles:

- **Play/Pause:** HTML5 Audio element with toggle button
- **Static waveform:** 24 bars with deterministic heights (seeded from index + duration), no AnalyserNode needed
- **Progress fill:** Bars transition from unfilled to filled (left-to-right) as audio plays via requestAnimationFrame
- **Duration display:** Shows total duration when stopped, remaining time during playback (M:SS format)
- **Loading state:** Spinner while audio buffers
- **Theming:** isMine prop adjusts colors for sent vs received bubbles (white on blue vs dark on light)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Static waveform for playback | Standard WhatsApp approach; avoids downloading/decoding full audio for visualization |
| Deterministic pseudo-random bar heights | Consistent visual per message without storing waveform data |
| Auto-start recording on mount | User already tapped mic; immediate start matches WhatsApp UX pattern |
| Sequential upload for media attachments | Simpler error handling; parallel upload adds complexity without significant UX gain for max 10 files |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` -- zero TypeScript errors (pre-existing NotificationContext error excluded)
- useVoiceRecorder handles full MediaRecorder lifecycle with AnalyserNode waveform
- VoiceRecorder shows animated waveform bars + timer during recording
- Cancel discards, send uploads blob to B2 and creates voice message
- MediaAttachmentSheet offers Gallery/Camera/Voice options with thumbnail previews
- VoicePlayback plays audio with static bar progress visualization
- Graceful fallback when MediaRecorder not supported (error UI with close button)
- Auto-stop at 60 seconds via stoppedRef guard preventing double-stop

## Next Phase Readiness

Voice recording hook and all 3 chat media components complete. Ready for:
- **03-10**: Chat UI assembly (MessageInput can integrate VoiceRecorder and MediaAttachmentSheet)
- **03-11+**: MessageBubble can render VoicePlayback for voice message type
