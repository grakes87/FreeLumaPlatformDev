---
phase: 12-content-production-platform
plan: 05
subsystem: content-pipeline
tags: [pipeline, orchestrator, tts, srt, b2, bible, positivity, idempotent]
depends_on: ["12-02", "12-03"]
provides: ["generateDayContent", "generateMonthContent", "pipeline-orchestration"]
affects: ["12-06", "12-07", "12-08"]
tech_stack:
  added: []
  patterns: ["idempotent-gap-fill", "progress-callback", "rate-limited-api-calls"]
key_files:
  created:
    - src/lib/content-pipeline/pipeline-runner.ts
  modified: []
decisions:
  - "B2 upload uses direct PutObjectCommand (server-side) not presigned URLs — matches existing video processing pattern"
  - "Positivity mode creates an EN translation row to enable TTS audio generation"
  - "Status only upgrades from empty to generated — never downgrades assigned/submitted/approved"
  - "TTS errors for individual translations don't abort the whole day — continues with others"
metrics:
  duration: "2 min"
  completed: "2026-02-17"
---

# Phase 12 Plan 05: Pipeline Runner Summary

Pipeline runner orchestrating all content generation modules into a complete day/month generation flow with idempotent gap-fill logic and progress callbacks.

## What Was Built

### `generateDayContent(date, mode, onProgress)`

The core single-day pipeline that executes these steps in order:

1. **Find/create DailyContent row** -- idempotent row creation for (date, mode, language=en)
2. **Bible verse selection** -- calls `selectRandomUnusedVerse()` then fetches KJV text via `fetchPassage`
3. **Bible translations** -- loops active BibleTranslation records, fetches each via `fetchPassage` with ESV 200ms rate limiting
4. **Positivity quote** -- calls `generatePositivityQuote()` via Claude API, creates EN translation row for TTS
5. **AI text generation** -- fills missing fields: devotional reflection, camera script, meditation script, background prompt
6. **TTS audio + SRT** -- generates audio via ElevenLabs (English) or Murf (Spanish/other), uploads to B2, generates SRT subtitles
7. **Record used verse** -- only after successful creation (idempotency guarantee)
8. **Status update** -- upgrades empty to generated, never downgrades

### `generateMonthContent(month, mode, onProgress)`

Loops day 1 to daysInMonth, calling `generateDayContent` for each. Tracks generated/failed/skipped counts, returns summary with failed day dates. Skip-on-failure ensures one bad day doesn't abort the month.

### B2 Upload Helpers

- `uploadBufferToB2(buffer, key, contentType)` -- direct PutObjectCommand for audio files
- `uploadStringToB2(content, key, contentType)` -- UTF-8 buffer wrapper for SRT files

## Key Design Decisions

- **Idempotent gap-fill**: Each field checked individually before generating. Re-running fills only what's missing.
- **Progress callbacks**: Every step emits a ProgressEvent (type, step, message) for real-time admin UI display.
- **Verse recording after success**: UsedBibleVerse created only after content fully generated, preventing verse waste on failures.
- **TTS error isolation**: Individual translation TTS failures don't abort the day -- logs error, continues with others.
- **Direct B2 upload**: Uses PutObjectCommand (same pattern as video thumbnail processing) instead of presigned URLs -- more reliable for server-side uploads.

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 288ca05 | Pipeline runner with generateDayContent and generateMonthContent |

## Next Phase Readiness

The pipeline runner is the central piece that the admin API endpoints (plan 12-06) will call. All module imports are verified. The pipeline is ready to be triggered from the admin content management UI.
