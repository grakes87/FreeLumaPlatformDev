# Phase 16: Daily Content Devotional - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a new devotional reflection slide to the daily content carousel for bible-mode users. The slide displays the AI-generated `devotional_reflection` text (already produced by the Phase 12 content pipeline) over the same video background as Slide 1. Inserted between the verse slide and the audio slide, making the new order: Verse → Devotional → Audio → LumaShort. Positivity mode and verse-by-category mode are unaffected.

</domain>

<decisions>
## Implementation Decisions

### New Devotional Slide
- New slide inserted between current Slide 1 (Verse) and Slide 2 (Audio)
- **New slide order:** Verse (1) → Devotional (2) → Audio (3) → LumaShort (4)
- **Bible mode only** — positivity mode keeps existing 3-slide structure
- Displays the `devotional_reflection` text from DailyContent model
- Shows the same `video_background_url` as the verse slide (Slide 1)
- Reflection text only — no verse reference, no journal prompt, no extra content

### Interactions
- **Share button only** — user can share the reflection as an image card
- No reactions bar or comment access on this slide
- Comments and reactions remain on the verse slide (Slide 1) as they are today

### Missing Content Fallback
- If `devotional_reflection` is null/empty for a given day, **skip the slide entirely**
- Carousel shows the original 3 slides (Verse → Audio → LumaShort) when no reflection exists
- No placeholder or "coming soon" message

### Claude's Discretion
- Text layout and typography on the devotional slide (font size, weight, positioning over video)
- Gradient overlay style for readability over video background
- Share image card design for devotional reflections
- Swiper pagination dot styling to accommodate 4 slides vs 3
- Any loading/transition behavior for the conditional slide

</decisions>

<specifics>
## Specific Ideas

- The devotional slide reuses the same video background as Slide 1 — maintaining the immersive feel across both slides
- Slide is conditionally rendered — only appears when devotional_reflection content exists for that day

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DailyPostCarousel.tsx` (264 lines): Swiper-based carousel — new slide inserts at index 1 (between DailyPostSlide and AudioPlayerSlide)
- `DailyPostSlide.tsx` (330 lines): Verse slide with video background + gradient overlay — devotional slide reuses the same video background pattern
- `ShareButton.tsx` (247 lines): Generates shareable image card — reuse for devotional reflection sharing
- `useDailyContent.ts` (250 lines): Already fetches DailyContent which includes devotional_reflection field

### Established Patterns
- DailyContent model already has `devotional_reflection` field (TEXT, nullable)
- Content production pipeline (Phase 12) generates devotional reflections via AI for bible mode
- `isActive` prop pattern for media isolation — new slide inherits this
- Conditional slide rendering already precedented (LumaShortSlide only shows when lumashort_video_url exists)
- Video background: muted autoplay looping `<video>` with `object-cover` positioning + gradient overlay

### Integration Points
- `DailyPostCarousel.tsx`: Insert DevotionalSlide component conditionally when `devotional_reflection` exists
- `/api/daily-posts/` routes: Already include `devotional_reflection` in response — no API changes needed
- `/api/daily-posts/feed/` route: Already includes devotional_reflection — feed mode carousel gets it automatically
- DailyFeed vertical scroll: No changes needed — DailyPostCarousel handles slide count internally

</code_context>

<deferred>
## Deferred Ideas

- **Quotes by Category for positivity mode** — Mirror verse-by-category with categorized positivity quotes. Future phase.
- **Meditation experience** — Surface meditation_script + meditation_audio_url for positivity mode. Separate phase.
- **Daily devotional routine** — Structured flow (read → reflect → journal → pray) with streaks and progress. Separate phase.
- **Positivity mode devotional slide** — Extend devotional reflection to positivity mode. Separate phase.

</deferred>

---

*Phase: 16-daily-content-devotional*
*Context gathered: 2026-03-11*
