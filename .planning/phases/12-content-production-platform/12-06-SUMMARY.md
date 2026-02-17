---
phase: 12-content-production-platform
plan: 06
subsystem: admin-api
tags: [admin, api, sse, content-production, assignment, review, background-video, streaming]
depends_on: ["12-04", "12-05"]
provides: ["month-overview-api", "sse-generation-endpoint", "field-regeneration", "content-assignment", "content-review", "background-video-linking"]
affects: ["12-09", "12-10", "12-11"]
tech_stack:
  added: []
  patterns: ["sse-streaming", "manual-auth-for-sse", "discriminated-union-zod", "status-transition-validation"]
key_files:
  created:
    - src/app/api/admin/content-production/route.ts
    - src/app/api/admin/content-production/generate/route.ts
    - src/app/api/admin/content-production/regenerate/route.ts
    - src/app/api/admin/content-production/assign/route.ts
    - src/app/api/admin/content-production/review/route.ts
    - src/app/api/admin/content-production/background-video/route.ts
  modified: []
decisions:
  - "SSE generate endpoint uses manual admin auth instead of withAdmin HOF because streaming Response cannot be wrapped by the middleware"
  - "Background video endpoint updates all DailyContent rows for a date (both bible and positivity modes)"
  - "Review status transitions are strictly validated: approve/reject only from submitted, revert only from approved"
  - "TTS/SRT regeneration uploads via presigned URL (client-side pattern) while pipeline-runner uses PutObjectCommand (server-side)"
metrics:
  duration: "6 min"
  completed: "2026-02-17"
---

# Phase 12 Plan 06: Admin Content Production API Routes Summary

Six admin API routes covering the complete content production workflow: month overview, SSE generation, field regeneration, assignment, review, and background video linking.

## What Was Built

### GET /admin/content-production (Month Overview)

Returns stats (total_days, generated, assigned, submitted, approved, rejected, missing) and a per-day array with: id, post_date, status, creator info (name, avatar from user), title, verse_reference, boolean flags for camera_script/devotional/meditation/background_prompt/creator_video, and per-translation status (has_audio, has_srt, has_chapter_text). Uses Sequelize includes for LumaShortCreator with nested User and DailyContentTranslation.

### POST /admin/content-production/generate (SSE Streaming)

The key innovation: streams real-time progress events to the client via Server-Sent Events. Manual admin auth check before creating the ReadableStream (withAdmin HOF cannot wrap streaming responses). Supports full month generation (calls generateMonthContent) or single day (calls generateDayContent). Each progress event sent as `data: JSON\n\n` format.

### POST /admin/content-production/regenerate (Field Regeneration)

Re-generates individual fields on existing content. Text fields (camera_script, devotional_reflection, meditation_script, background_prompt) call the appropriate text-generation function. TTS/SRT fields require a translation_code and re-generate audio + subtitles for that specific translation via ElevenLabs or Murf based on language.

### POST /admin/content-production/assign (Assignment)

Uses Zod discriminated union for two actions:
- **auto_assign**: calls autoAssignMonth() for round-robin distribution respecting monthly capacity
- **reassign**: calls reassignDay() for individual creator changes with mode compatibility checks

### POST /admin/content-production/review (Approve/Reject/Revert)

Status transition validation:
- **approve**: only from 'submitted' -> 'approved', clears rejection_note
- **reject**: only from 'submitted' -> 'rejected', requires rejection_note
- **revert**: only from 'approved' -> 'submitted' (admin un-approves to swap content)

### POST /admin/content-production/background-video (Video Linking)

Batch links uploaded video URLs to daily content records by date. Accepts array of {date, video_url} pairs, updates all DailyContent rows matching each date. Returns count of updated records and list of dates with no matching content.

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 71cf699 | Month overview, SSE generation, and field regeneration routes |
| 2 | bfca5fa | Assignment, review, and background video routes |

## Next Phase Readiness

All admin API routes are ready for the admin content management UI (plan 12-09+). The SSE generation endpoint can be consumed by EventSource or fetch with ReadableStream on the client. The month overview provides all data needed for a calendar-style admin dashboard.
