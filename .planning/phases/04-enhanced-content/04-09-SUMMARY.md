---
phase: 04-enhanced-content
plan: 09
subsystem: ui
tags: [video, ffmpeg, thumbnail, captions, whisper, openai, admin, upload, presigned-url, b2]

requires:
  - phase: 04-04
    provides: Video CRUD API, VideoCategory CRUD API, hero endpoint, presigned URL pattern
provides:
  - extractThumbnail() function using fluent-ffmpeg + sharp (640x360 webp)
  - generateCaptions() function using OpenAI Whisper with null client pattern
  - POST /api/videos/[id]/process background processing endpoint
  - Admin video management page with upload, list, edit, delete, publish, hero controls
  - VideoUploadForm with presigned URL upload flow and progress bar
  - VideoCategoryManager with CRUD, inline edit, and sort ordering
  - Presigned URL video type support with 4-hour expiry
affects: [04-enhanced-content frontend video player, video browse UI]

tech-stack:
  added: [fluent-ffmpeg, ffmpeg-static, openai, "@types/fluent-ffmpeg"]
  patterns:
    - "FFmpeg thumbnail extraction: probe duration -> seek to percent -> extract frame -> sharp resize to webp"
    - "OpenAI Whisper null client: skip when OPENAI_API_KEY not set, lazy import openai library"
    - "Fire-and-forget processing: upload form triggers background POST /api/videos/[id]/process after metadata save"
    - "XHR upload progress: XMLHttpRequest for presigned PUT with upload.onprogress percentage tracking"

key-files:
  created:
    - src/lib/video/thumbnail.ts
    - src/lib/video/captions.ts
    - src/app/api/videos/[id]/process/route.ts
    - src/app/(admin)/admin/videos/page.tsx
    - src/components/admin/VideoUploadForm.tsx
    - src/components/admin/VideoCategoryManager.tsx
  modified:
    - src/app/api/upload/presigned/route.ts
    - src/components/admin/AdminNav.tsx

key-decisions:
  - "FFmpeg frame extraction pipes to writable stream, avoids temp files on disk"
  - "Whisper audio extraction uses 64kbps mono MP3 to reduce upload size for transcription"
  - "Processing endpoint non-fatal: thumbnail and caption failures logged but don't fail request"
  - "Video presigned URL 4-hour expiry for large file uploads (vs 1-hour default)"
  - "Admin video list fetches from grouped Netflix API, flattens categories for table view"
  - "Category reorder swaps sort_order values between adjacent categories"

patterns-established:
  - "Video processing pipeline: upload to B2 -> save metadata -> fire-and-forget background process"
  - "Admin management page tab layout: Videos/Categories tabs with shared state"
  - "Upload type extension: ALLOWED_CONTENT_TYPES + ADMIN_ONLY_TYPES + EXPIRY_OVERRIDES maps in presigned route"

duration: 7min
completed: 2026-02-14
---

# Phase 4 Plan 9: Video Upload Processing & Admin Management Summary

**FFmpeg thumbnail extraction + OpenAI Whisper captions with admin video management page, presigned URL upload flow, and category manager**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-14T06:58:41Z
- **Completed:** 2026-02-14T07:05:35Z
- **Tasks:** 2
- **Files created:** 6
- **Files modified:** 2

## Accomplishments
- Video thumbnail extraction using fluent-ffmpeg (seek to frame) + sharp (resize to 640x360 webp)
- Caption generation using OpenAI Whisper with null client pattern (graceful no-op when API key missing)
- Background processing endpoint that uploads thumbnails and captions to B2 after video creation
- Full admin video management page with upload form, list view, edit, delete, publish/unpublish, hero toggle
- VideoUploadForm with presigned URL upload, progress bar, and fire-and-forget processing trigger
- VideoCategoryManager with inline CRUD, sort ordering, and delete guard for non-empty categories
- Extended presigned URL endpoint with video type support and 4-hour expiry for large files

## Task Commits

Each task was committed atomically:

1. **Task 1: Video processing utilities (thumbnail + captions)** - `5a592f3` (feat)
2. **Task 2: Admin video management page and upload form** - `54e9ce1` (feat)

## Files Created/Modified
- `src/lib/video/thumbnail.ts` - extractThumbnail() using fluent-ffmpeg + sharp for 640x360 webp frames
- `src/lib/video/captions.ts` - generateCaptions() using OpenAI Whisper with null client pattern
- `src/app/api/videos/[id]/process/route.ts` - POST endpoint for background thumbnail + caption processing
- `src/app/(admin)/admin/videos/page.tsx` - Admin video management page with Videos/Categories tabs
- `src/components/admin/VideoUploadForm.tsx` - Upload form with presigned URL flow and progress bar
- `src/components/admin/VideoCategoryManager.tsx` - Category CRUD with sort ordering and delete guard
- `src/app/api/upload/presigned/route.ts` - Extended with video type, 4-hour expiry
- `src/components/admin/AdminNav.tsx` - Added Videos link to admin sidebar

## Decisions Made
- FFmpeg frame extraction uses piped writable stream instead of temp files for server-side safety
- Whisper audio extraction at 64kbps mono MP3 minimizes upload size for transcription API
- Processing endpoint treats thumbnail and caption failures as non-fatal (logged, not thrown)
- Video presigned URLs get 4-hour expiry (vs 1-hour default) for large file uploads
- Admin video list flattens the Netflix-style grouped API response into a flat list for table display
- Category reorder swaps sort_order values between adjacent items via parallel PUT requests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Buffer to BlobPart TypeScript error in captions.ts**
- **Found during:** Task 1 (captions utility)
- **Issue:** `new File([audioBuffer], ...)` failed because Node Buffer is not assignable to BlobPart in strict mode
- **Fix:** Wrapped with `new Uint8Array(audioBuffer)` for proper BlobPart compatibility
- **Files modified:** src/lib/video/captions.ts
- **Committed in:** 5a592f3

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal - TypeScript type compatibility fix. No scope creep.

## Issues Encountered

None.

## User Setup Required

**Optional:** OpenAI API key for caption generation.
- Set `OPENAI_API_KEY` in `.env.local` for Whisper caption generation
- Source: OpenAI Dashboard -> API keys -> Create new secret key
- Without this key, captions are gracefully skipped (thumbnails still work)

## Next Phase Readiness
- Video upload and management pipeline complete
- Admin can upload, organize, publish, and manage video library
- Background processing generates thumbnails automatically
- Captions ready when OpenAI API key is configured
- Ready for frontend video player and browse UI

---
*Phase: 04-enhanced-content*
*Completed: 2026-02-14*
