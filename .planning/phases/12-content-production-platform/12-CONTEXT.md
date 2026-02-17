# Phase 12: Content Production Platform - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end daily content production pipeline for admin and creators. Admin generates bible verses and positivity content for a month with multi-translation support, TTS audio, SRT subtitles, background video prompts, and 45-second camera scripts. Creators (human and AI) are managed in a LumaShortCreator registry, auto-assigned scripts via round-robin, and record videos through an in-platform teleprompter. Admin reviews, approves, and schedules content. HeyGen AI generates videos for non-English AI creators.

</domain>

<decisions>
## Implementation Decisions

### Content Generation Pipeline

**Verse Selection:**
- Random unused KJV verse from the entire Bible (no exclusions, no curation)
- Used verses tracked in a dedicated table to prevent repetition
- All active bible_translations from DB auto-fetched for each verse (including ESV with rate limiting)

**Positivity Content:**
- AI-generated original quotes via Claude (Anthropic API)
- Structured meditation template: opening breath -> visualization -> affirmation -> closing
- Meditation script ~1 minute read time

**AI Text Generation:**
- Claude (Anthropic API) for all text generation: positivity quotes, devotional reflections, camera scripts, meditation scripts, background video prompts
- Bible mode includes AI-generated devotional reflection (4-6 sentence short paragraph) per verse — text-only, NOT converted to TTS
- Camera script: conversational and warm tone, 45 seconds, for human creator to read to camera

**TTS Audio:**
- One voice per language — single consistent voice
- ElevenLabs for English, Murf for Spanish (and any other non-English)
- Both voice IDs admin-configurable in platform settings
- TTS scope: chapter_text (verse per translation) + meditation script (positivity mode)
- Devotional reflection, camera script, and background video prompt are text-only (no TTS)

**SRT Subtitles:**
- Generated from TTS audio analysis (timing data from audio, not estimated from text)
- SRT generated for both verse audio AND meditation script audio

**Background Video Prompts:**
- Detailed cinematic prompts — camera angles, mood, color palette
- Must NOT include people (background scenery only)
- Text prompt output only — admin manually uses Sora/Veo to generate video, then uploads
- No API integration for video generation (prompt text only)

**Generation Scope:**
- Full month at once (all 28-31 days)
- Bible and positivity content triggered separately (separate buttons)
- English + Spanish (all translations) generated together in one pipeline run
- Idempotent: only fills missing content, NEVER overwrites existing data
- Smart gap-fill: if a day has partial content (e.g., verse exists but TTS missing), fills in just the missing pieces
- On failure: skip failed day and continue generating remaining days; failed day flagged for admin

**Progress Feedback:**
- Modal overlay with scrolling step log showing real-time progress
- "Day 5/31: Generating TTS..." style per-day, per-step log entries

### Creator Management & Assignment

**Creator Profile (LumaShortCreator):**
- Extended profile: name, language(s), monthly capacity, bible/positivity capability flags, is_ai boolean
- Bio, user avatar (from linked user account), 3 free-form URL link fields
- Linked to a user account in the platform (user_id FK)
- AI creators use same model with is_ai=true flag (no separate config)

**Attribution:**
- Creator name + small avatar displayed on daily content ("Recorded by [Name]")
- Non-linking — displays only, no navigation to profile

**Assignment Logic:**
- Round-robin within capacity: distribute evenly across eligible creators until monthly capacity reached
- Creators at capacity skipped in round-robin
- Capacity auto-resets on 1st of each month
- Per-creator mode flags: each creator can handle bible, positivity, or both
- Admin can freely reassign any day's content to a different creator at any time

**Creator Removal:**
- Already-completed content stays with creator attribution
- Pending assignments become unassigned
- Creator record soft-deactivated (not deleted)

### Creator Portal (/creator route group)

**Dashboard:**
- Dedicated /creator route section (separate from /app and /admin)
- Access: any user with linked LumaShortCreator record (no separate role needed)
- Shows: assignment list, upload area, personal stats (completed, pending, upcoming)
- Full read access to all generated content for assigned days (verse, translations, script, prompt, etc.)

**Teleprompter Recording Mode:**
- Portrait (vertical video) recording via front-facing camera
- Semi-transparent script overlay on camera preview
- Auto-scroll at adjustable speed
- 45-second countdown timer with visual cue (color change) when approaching end
- After recording: preview, then re-record or submit
- Latest take replaces previous (no multi-take storage)
- Upload raw video — server-side processing (FFmpeg compression + thumbnail) for mobile stability

**Deadlines & Notifications:**
- All videos due by 15th of each month
- Email notification when new scripts are assigned
- Email notification with rejection note when admin rejects video

**Creator Stats:**
- Personal stats only (no leaderboard): videos completed, pending, viewer engagement

### Admin Content Management UI

**Page Structure:**
- New tab in existing admin dashboard ("Content Production")
- Month/year selector at top
- Top-level Bible/Positivity toggle filtering all tabs
- Stats header per month: total days, generated, assigned, submitted, approved, missing

**5-Tab Workflow:**

1. **Unassigned** — Days missing content
   - Bulk "Generate Month" button + individual per-day generate buttons
   - Shows empty days needing content generation

2. **Assigned** — Creator assignments
   - Toggleable per-day view and per-creator grouped view
   - Creator name per day with dropdown to change assignment
   - Auto-assign button for round-robin distribution

3. **Pending** — Days with missing fields
   - Red X / green check badges per field (verse, TTS, SRT, script, prompt, video)
   - Per-field regenerate buttons
   - Expandable card showing all generated content fields (read-only)

4. **Completed** — Fully-filled content
   - Approve action: schedules content for its calendar date (approved = scheduled)
   - One-at-a-time approval (no bulk approve)
   - Full immersive preview (3-slide daily experience as users will see it)
   - Admin can un-approve (revert to submitted) to swap content last minute

5. **Background Videos** — Upload background video files
   - Bulk upload with YYYY-MM-DD-background.mp4 filename convention
   - System matches filename to calendar date

**Day Card (Expandable):**
- Collapsed: date + overall status
- Expanded: all generated content fields (read-only) with per-field regenerate buttons
- No inline editing — regenerate or accept

### Content Lifecycle

**Status Transitions:**
```
Empty -> Generated -> Assigned -> Video Submitted -> Rejected/Approved
                                        ^                |
                                        |  (re-record)   |
                                        +--- Rejected ---+
```

- Approved = automatically scheduled for its calendar date
- Admin can revert approved content back to submitted
- Rejection includes admin text note; creator gets email with feedback

### HeyGen AI Video Integration

**Scope:**
- HeyGen used for ANY non-English AI creator (not just Spanish)
- AI creators marked with is_ai=true on LumaShortCreator
- Per-creator HeyGen avatar ID stored on creator profile
- Global HeyGen API key stored in platform settings

**Triggering:**
- Bulk trigger per month (admin generates all non-English AI videos for the month at once)
- Background processing — admin gets in-app notification when complete
- On failure: mark as failed, admin retries manually

**Review:**
- AI-generated videos go through same approval flow as human creator videos
- No auto-approval for AI content

### Claude's Discretion
- Exact Claude API prompt engineering for quotes, devotionals, scripts, meditation
- SRT timing algorithm from TTS audio data
- ESV API rate limiting strategy
- Round-robin assignment algorithm details
- Teleprompter auto-scroll speed defaults and adjustment increments
- Mobile video recording API implementation (MediaRecorder vs native)
- Server-side video processing pipeline specifics
- HeyGen API integration details (webhook vs polling for completion)
- Real-time progress modal implementation (SSE vs polling)
- Share card generation (existing on-the-fly pattern, not pre-generated)

</decisions>

<specifics>
## Specific Ideas

- Background video prompts: "detailed cinematic" with camera angles, mood, color palette — no people, scenery only
- Camera script tone: "conversational and warm — like a friend sharing an insight"
- Meditation template structure: opening breath -> visualization -> affirmation -> closing (~1 minute)
- Teleprompter: semi-transparent script overlay on camera preview with auto-scroll
- Creator portal is a fully separate /creator route group, not embedded in /app or /admin
- Background video upload uses strict YYYY-MM-DD-background.mp4 naming convention for date matching
- Real-time generation progress shows as a modal with scrolling step log
- Content is NEVER overwritten — only missing data gets generated (idempotent)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-content-production-platform*
*Context gathered: 2026-02-17*
