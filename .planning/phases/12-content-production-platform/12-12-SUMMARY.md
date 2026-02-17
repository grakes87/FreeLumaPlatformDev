---
phase: 12-content-production-platform
plan: 12
subsystem: creator-portal
tags: [mediarecorder, teleprompter, video-recording, presigned-upload, b2]
depends_on: ["12-07", "12-11"]
provides:
  - Teleprompter recording page route /creator/record/[id]
  - useMediaRecorder hook for camera and video capture
  - Teleprompter component with script overlay and auto-scroll
  - RecordingControls component with record/stop/preview/submit states
  - creator-video presigned upload type for B2
affects: ["12-13", "12-14"]
tech_stack:
  added: []
  patterns:
    - "MediaRecorder API with mp4/webm MIME detection"
    - "XHR upload with progress tracking via presigned PUT"
    - "Dynamic import with ssr:false for browser-only APIs"
key_files:
  created:
    - src/hooks/useMediaRecorder.ts
    - src/components/creator/Teleprompter.tsx
    - src/components/creator/RecordingControls.tsx
    - src/app/(app)/creator/record/[id]/page.tsx
  modified:
    - src/app/api/upload/presigned/route.ts
decisions:
  - id: "creator-video-upload-type"
    decision: "Added creator-video as a non-admin upload type with 2hr expiry (vs 4hr for admin video)"
    rationale: "Creators need presigned URL access for B2 uploads without admin privileges"
metrics:
  duration: "5 min"
  completed: "2026-02-17"
---

# Phase 12 Plan 12: Teleprompter Recording Experience Summary

**One-liner:** Full-screen teleprompter with mirrored camera preview, auto-scrolling script overlay, 45-second countdown, MediaRecorder video capture, and presigned B2 upload with progress tracking.

## What Was Done

### Task 1: useMediaRecorder Hook + Teleprompter Component

**useMediaRecorder.ts (226 lines):**
- Front-facing camera with portrait orientation (1080x1920) and audio
- MIME type detection: tries mp4 codecs first (iOS/Safari), falls back to webm (Chrome/Firefox)
- Full lifecycle: startCamera -> startRecording -> stopRecording -> resetRecording -> stopCamera
- Chunk-based recording (100ms intervals) for robust capture
- Proper cleanup on unmount (stops tracks, revokes object URLs)
- Descriptive error messages for NotAllowedError, NotFoundError

**Teleprompter.tsx (218 lines):**
- Fixed full-screen layout with mirrored camera preview (scaleX(-1) for selfie view)
- Semi-transparent script overlay on bottom 40% (bg-black/40 with backdrop-blur)
- 3 scroll speeds: Slow (0.5px/frame), Medium (1.2px/frame), Fast (2.0px/frame)
- Auto-scroll starts/stops with recording, resets scroll position on new recording
- 45-second countdown timer with color transitions: white -> amber (10s) -> red (5s) -> "TIME" (0s)
- Red pulsing recording indicator (REC) with ping animation
- Collapsible script panel for full camera view

### Task 2: Recording Page + RecordingControls

**RecordingControls.tsx (167 lines):**
- Three states: pre-recording (red record button), recording (stop button with elapsed time), post-recording (preview + re-record + submit)
- Video preview in 9:16 aspect ratio container
- Upload progress bar with percentage display
- Disabled states during submission

**page.tsx (312 lines):**
- Fetches assignment via /api/creator/content/[id], verifies status is 'assigned' or 'rejected'
- Dynamic imports (ssr: false) for Teleprompter and RecordingControls
- Three-step submit flow:
  1. GET /api/upload/presigned?type=creator-video to get presigned URL
  2. XHR PUT to B2 with progress tracking (10-90% range)
  3. POST /api/creator/upload with video_url for status update
- Error handling with retry for camera access, toast for submit errors
- Proper cleanup: stopCamera on unmount, URL.revokeObjectURL

**Presigned URL route update:**
- Added 'creator-video' upload type (video/mp4, video/webm, video/quicktime)
- 2-hour expiry (shorter than admin 4-hour for videos)
- Not in ADMIN_ONLY_TYPES -- any authenticated creator can use it
- Key prefix: 'creator-videos/' for organized B2 storage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added creator-video presigned upload type**
- **Found during:** Task 2
- **Issue:** The existing presigned URL route only allowed admin users to upload videos. Creators need their own upload path.
- **Fix:** Added 'creator-video' upload type with appropriate MIME types, 2hr expiry, and 'creator-videos/' key prefix
- **Files modified:** src/app/api/upload/presigned/route.ts
- **Commit:** 0b403b8

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 468d534 | feat | useMediaRecorder hook and Teleprompter component |
| 0b403b8 | feat | Recording page, controls, and presigned upload support |

## Verification

- TypeScript: All new files compile without errors
- Artifacts: Teleprompter 218 lines (>100), RecordingControls 167 lines (>60)
- Key patterns: facingMode 'user' in useMediaRecorder, fetch('/api/creator/upload') in page
- Export: useMediaRecorder exported from hook, default export from page
