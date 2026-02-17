---
phase: 12-content-production-platform
plan: 08
subsystem: heygen-integration
tags: [heygen, ai-video, avatar, webhook, admin-api]
dependency-graph:
  requires: ["12-01", "12-04"]
  provides: ["heygen-client-library", "heygen-admin-trigger", "heygen-webhook"]
  affects: ["12-09", "12-10"]
tech-stack:
  added: []
  patterns: ["external-api-client", "webhook-handler", "platform-setting-tracking"]
key-files:
  created:
    - src/lib/heygen/index.ts
    - src/app/api/admin/content-production/heygen/route.ts
    - src/app/api/webhooks/heygen/route.ts
  modified: []
decisions:
  - id: "heygen-pending-tracking"
    choice: "PlatformSetting JSON map for pending video tracking"
    reason: "Simple key-value storage sufficient for tracking video_id -> content_id mapping without new table"
  - id: "heygen-webhook-always-200"
    choice: "Webhook always returns 200 even on errors"
    reason: "Prevents HeyGen from retrying and creating duplicate processing"
  - id: "heygen-rate-limit"
    choice: "1 second delay between API calls"
    reason: "Respects HeyGen rate limits during bulk generation"
metrics:
  duration: "2 min"
  completed: "2026-02-17"
---

# Phase 12 Plan 08: HeyGen AI Video Integration Summary

HeyGen REST API client with admin bulk trigger and completion webhook for AI creator video generation.

## What Was Built

### HeyGen Client Library (`src/lib/heygen/index.ts`)
- `createHeygenVideo()`: POST to HeyGen v2 API with portrait 1080x1920 dimensions, supports avatar ID, script text, callback URL, and optional voice ID override
- `checkHeygenStatus()`: GET video status with normalized values (pending/processing/completed/failed)
- `HeygenError` class with status code and API error message for typed error handling
- Status normalization handles HeyGen's various status strings (done/completed, rendering/processing, error/failed)

### Admin Trigger Route (`src/app/api/admin/content-production/heygen/route.ts`)
- **POST**: Bulk trigger HeyGen generation for AI creators in a given month
  - Validates month (YYYY-MM) and mode (bible/positivity) via Zod
  - Gets API key from PlatformSetting `heygen_api_key`, returns 503 if missing
  - Finds active AI creators with HeyGen avatar IDs matching the mode
  - For each creator, finds assigned DailyContent without videos
  - Calls createHeygenVideo with 1s delay between calls (rate limiting)
  - Tracks pending videos in PlatformSetting `heygen_pending_videos` JSON map
  - Skips content already in pending map (prevents double-triggering)
  - Returns trigger count, AI creator count, and any errors
- **GET**: Returns all pending HeyGen videos with their tracking info

### Webhook Handler (`src/app/api/webhooks/heygen/route.ts`)
- **POST**: HeyGen completion callback (no auth -- external service)
  - Handles both nested (`data.video_id`) and flat (`video_id`) payload formats
  - On completion: updates DailyContent `creator_video_url` and sets status to `submitted`
  - On failure: logs error, removes from pending map
  - On in-progress: logs status, keeps in pending map
  - Always returns 200 to prevent retry loops
- **GET**: Health check endpoint for webhook URL verification

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 95a1b66 | feat(12-08): create HeyGen REST API client library |
| 8b38567 | feat(12-08): add HeyGen admin trigger route and webhook handler |

## Verification

- TypeScript compilation passes for all three files
- Portrait dimensions (1080x1920) confirmed in createHeygenVideo body
- Rate limiting (1s delay) implemented between bulk API calls
- Webhook updates DailyContent creator_video_url on completion
- Failed videos logged with console.error and removed from pending map
