# Phase 16: Daily Content Devotional - Research

**Researched:** 2026-03-11
**Domain:** Frontend UI slide insertion + API field exposure
**Confidence:** HIGH

## Summary

This phase adds a devotional reflection slide to the daily content carousel for bible-mode users. The work is primarily frontend with a small API change: three API routes need to include the existing `devotional_reflection` field in their responses, and a new `DevotionalSlide` component needs to be created and conditionally inserted into the Swiper carousel.

The codebase already has all the infrastructure needed. The `DailyContent` Sequelize model has a `devotional_reflection` TEXT field (nullable). The Phase 12 content pipeline generates devotional reflections for bible-mode content via `generateDevotionalReflection()`. The carousel uses Swiper 12 with pagination dots and `isActive` prop-based media isolation. Conditional slide rendering is already precedented by the LumaShortSlide (which shows a placeholder when `lumashort_video_url` is null). The `ShareButton` component can be reused for sharing the reflection text as an image card.

**Primary recommendation:** Add `devotional_reflection` to all three daily-posts API response objects, update the `DailyContentData` TypeScript interface, create a `DevotionalSlide` component that mirrors the DailyPostSlide video background pattern, and conditionally insert it at index 1 in the carousel when the field is non-empty. No database migrations needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New slide inserted between current Slide 1 (Verse) and Slide 2 (Audio)
- **New slide order:** Verse (1) -> Devotional (2) -> Audio (3) -> LumaShort (4)
- **Bible mode only** -- positivity mode keeps existing 3-slide structure
- Displays the `devotional_reflection` text from DailyContent model
- Shows the same `video_background_url` as the verse slide (Slide 1)
- Reflection text only -- no verse reference, no journal prompt, no extra content
- **Share button only** -- user can share the reflection as an image card
- No reactions bar or comment access on this slide
- Comments and reactions remain on the verse slide (Slide 1) as they are today
- If `devotional_reflection` is null/empty for a given day, **skip the slide entirely**
- Carousel shows the original 3 slides (Verse -> Audio -> LumaShort) when no reflection exists
- No placeholder or "coming soon" message

### Claude's Discretion
- Text layout and typography on the devotional slide (font size, weight, positioning over video)
- Gradient overlay style for readability over video background
- Share image card design for devotional reflections
- Swiper pagination dot styling to accommodate 4 slides vs 3
- Any loading/transition behavior for the conditional slide

### Deferred Ideas (OUT OF SCOPE)
- Quotes by Category for positivity mode
- Meditation experience for positivity mode
- Daily devotional routine (structured flow with streaks)
- Positivity mode devotional slide
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Swiper | ^12.1.0 | Carousel/slide navigation | Already in use for DailyPostCarousel |
| React | 19.2.3 | UI components | Project framework |
| Next.js | 16.1.6 | API routes + SSR | Project framework |
| Sequelize | (existing) | ORM for DailyContent model | Already configured with devotional_reflection field |
| lucide-react | (existing) | Icons (Share2, Check) | Consistent with all existing slides |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Canvas API (browser) | Built-in | Share image generation | ShareButton already uses it for verse cards |
| tailwindcss | (existing) | Styling | All component styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas share image | html2canvas | Heavier dependency; Canvas API already works well in ShareButton |

**Installation:**
```bash
# No new dependencies needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/daily/
│   ├── DevotionalSlide.tsx        # NEW: Devotional reflection slide component
│   ├── DailyPostCarousel.tsx      # MODIFY: Insert DevotionalSlide conditionally
│   ├── DailyPostSlide.tsx         # UNCHANGED (verse slide)
│   ├── AudioPlayerSlide.tsx       # UNCHANGED (audio slide)
│   ├── LumaShortSlide.tsx         # UNCHANGED (LumaShort slide)
│   └── ShareButton.tsx            # REUSE: Share devotional as image card
├── hooks/
│   └── useDailyContent.ts         # MODIFY: Add devotional_reflection to DailyContentData type
└── app/api/daily-posts/
    ├── route.ts                   # MODIFY: Include devotional_reflection in response
    ├── [date]/route.ts            # MODIFY: Include devotional_reflection in response
    └── feed/route.ts              # MODIFY: Include devotional_reflection in response
```

### Pattern 1: Conditional Slide Insertion (Carousel)
**What:** Conditionally render a Swiper slide based on content availability
**When to use:** When a slide should only appear when its content field is non-null
**Example:**
```typescript
// Source: Existing DailyPostCarousel.tsx CarouselSwiper pattern
// The devotional slide is inserted at index 1 (between verse and audio)
// ONLY when devotional_reflection is present and mode is 'bible'

const hasDevotional = content.mode === 'bible' &&
  content.devotional_reflection &&
  content.devotional_reflection.trim() !== '';

return (
  <Swiper modules={[Pagination, Keyboard]} slidesPerView={1} pagination={...}>
    {/* Slide 1: Verse */}
    <SwiperSlide>
      <DailyPostSlide content={slideContent} isActive={isActive && activeSlide === 0} ... />
    </SwiperSlide>

    {/* Slide 2: Devotional (conditional) */}
    {hasDevotional && (
      <SwiperSlide>
        <DevotionalSlide content={slideContent} isActive={isActive && activeSlide === 1} />
      </SwiperSlide>
    )}

    {/* Slide 3 (or 2): Audio */}
    <SwiperSlide>
      <AudioPlayerSlide content={content} isActive={isActive && activeSlide === (hasDevotional ? 2 : 1)} ... />
    </SwiperSlide>

    {/* Slide 4 (or 3): LumaShort */}
    <SwiperSlide>
      <LumaShortSlide content={content} isActive={isActive && activeSlide === (hasDevotional ? 3 : 2)} />
    </SwiperSlide>
  </Swiper>
);
```

### Pattern 2: Video Background Reuse (DailyPostSlide pattern)
**What:** Muted autoplay looping video with gradient overlay for text readability
**When to use:** For the devotional slide background (same as verse slide)
**Example:**
```typescript
// Source: DailyPostSlide.tsx lines 132-161
// Key elements: dark base layer, <video> with object-cover, gradient overlay

<div className="relative flex h-full w-full items-center justify-center overflow-hidden">
  <div className="absolute inset-0 bg-[#0a0a0f]" />
  {hasVideo && (
    <video
      ref={bgVideoRef}
      src={content.video_background_url}
      crossOrigin="anonymous"
      autoPlay muted loop playsInline preload="auto"
      className="absolute inset-0 h-full w-full object-cover"
    />
  )}
  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/40" />
  {/* Content overlay */}
</div>
```

### Pattern 3: isActive Media Isolation
**What:** Each slide receives an `isActive` boolean to pause/play media when not visible
**When to use:** Any slide with video or audio content
**Example:**
```typescript
// Source: DailyPostSlide.tsx lines 40-48
// The devotional slide should pause its background video when not active

useEffect(() => {
  const video = bgVideoRef.current;
  if (!video) return;
  if (isActive) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
}, [isActive]);
```

### Pattern 4: ShareButton Reuse for Devotional Text
**What:** ShareButton generates a canvas-based image card for sharing
**When to use:** For the devotional slide's share functionality
**Example:**
```typescript
// Source: ShareButton.tsx -- accepts verseText, reference, translationCode, mode, videoRef
// For devotional slide: pass devotional text as verseText, null for reference

<ShareButton
  verseText={content.devotional_reflection}  // The reflection text
  reference={null}                            // No reference line for devotional
  translationCode={null}                      // No translation code
  mode={content.mode}                         // 'bible' -- determines gradient colors
  videoRef={bgVideoRef}                       // Same video for background capture
/>
```

### Anti-Patterns to Avoid
- **Duplicating video background logic:** Don't copy-paste the video background code from DailyPostSlide. Extract a shared pattern or keep it contained in DevotionalSlide with the same approach.
- **Hardcoded slide indices:** Don't hardcode `activeSlide === 1` for audio when the devotional may or may not be present. Calculate offsets based on `hasDevotional`.
- **Fetching devotional_reflection separately:** Don't create a new API endpoint. Add it to existing daily-posts API responses.
- **Adding reactions/comments to DevotionalSlide:** User explicitly decided against this -- share button only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Carousel navigation | Custom swipe handler | Swiper 12 (already used) | Touch handling, pagination dots, keyboard nav all handled |
| Share image generation | Custom image library | Canvas API via existing ShareButton | Already working with video frame capture + gradient fallback |
| Video background | Custom video player | Native HTML5 `<video>` element | Same pattern as DailyPostSlide -- autoplay muted loop |
| Responsive text sizing | Media query breakpoints | Existing Tailwind responsive classes | Match DailyPostSlide typography pattern |

**Key insight:** Nearly everything needed already exists in the codebase. The DevotionalSlide is structurally a simplified version of DailyPostSlide (same background, similar text layout, but no reactions/comments -- just share).

## Common Pitfalls

### Pitfall 1: Swiper Slide Index Shift When Conditional Slide Appears
**What goes wrong:** When the devotional slide is conditionally rendered, the `activeSlide` index values shift for all subsequent slides. If not handled, the `isActive` prop will be wrong for audio and LumaShort slides, causing media to play/pause incorrectly.
**Why it happens:** `onSlideChange` fires with `swiper.activeIndex` which is a positional index. Adding/removing a slide changes the positions of all slides after it.
**How to avoid:** Calculate audio and LumaShort slide indices dynamically based on whether the devotional slide is present: `const audioIndex = hasDevotional ? 2 : 1; const lumaShortIndex = hasDevotional ? 3 : 2;`
**Warning signs:** Audio plays when swiping to devotional slide, or LumaShort starts playing when on audio slide.

### Pitfall 2: Video Background Performance with Multiple Video Elements
**What goes wrong:** DevotionalSlide creates a second `<video>` element with the same `video_background_url` as DailyPostSlide. Two video elements loading the same URL means double bandwidth on mobile.
**Why it happens:** Each slide independently mounts its own video element.
**How to avoid:** The `isActive` prop pattern already mitigates this -- only one slide is active at a time. Swiper keeps inactive slides in the DOM but `isActive` pauses the video. Browser caching should prevent double-downloading from CDN. The `preload="auto"` on DailyPostSlide means the video is already in the browser cache when DevotionalSlide mounts. Consider using `preload="none"` on the devotional slide and only loading on first activation.
**Warning signs:** Noticeable lag when swiping to the devotional slide for the first time.

### Pitfall 3: Tainted Canvas on Cross-Origin Video Share
**What goes wrong:** ShareButton tries to draw the video frame to canvas for the share image, but the video is cross-origin (served from Backblaze B2 CDN), causing a SecurityError.
**Why it happens:** Canvas becomes tainted when drawing cross-origin media.
**How to avoid:** This is already handled by ShareButton -- it catches the tainted canvas error and falls back to a gradient background. The `crossOrigin="anonymous"` attribute on the video tag + CORS headers from B2/Cloudflare typically allow canvas export. Same pattern as DailyPostSlide.
**Warning signs:** Share image always shows gradient instead of video frame.

### Pitfall 4: Missing devotional_reflection in DailyContentData Type
**What goes wrong:** TypeScript build errors or runtime undefined access if the type doesn't include the new field.
**Why it happens:** The `DailyContentData` interface in `useDailyContent.ts` currently doesn't include `devotional_reflection`.
**How to avoid:** Add `devotional_reflection: string | null` to the interface. All three API routes must include it in their response objects.
**Warning signs:** TypeScript errors during build, `undefined` when accessing `content.devotional_reflection`.

### Pitfall 5: Pagination Dot Styling for 3 vs 4 Slides
**What goes wrong:** With 4 slides, pagination dots may look cramped or overflow, especially on smaller screens.
**Why it happens:** The pagination dot container auto-adjusts but wasn't designed for 4 dots.
**How to avoid:** Test both 3-slide (no devotional) and 4-slide (with devotional) states. The current Swiper pagination config uses `bulletClass` and `bulletActiveClass` with fixed styling. The conditional nature means some days show 3 dots and some show 4 -- both must look correct.
**Warning signs:** Dots overlapping or pagination area looking unbalanced.

## Code Examples

### Example 1: API Route -- Adding devotional_reflection to Response
```typescript
// Source: src/app/api/daily-posts/route.ts lines 121-135
// Add devotional_reflection to the response object in all three routes

const response = {
  id: content.id,
  post_date: content.post_date,
  mode: content.mode,
  language: content.language,
  title: content.title,
  content_text: content.content_text,
  verse_reference: content.verse_reference,
  chapter_reference: content.chapter_reference,
  video_background_url: content.video_background_url,
  lumashort_video_url: content.lumashort_video_url,
  devotional_reflection: content.devotional_reflection,  // ADD THIS
  translations,
  translation_names: translationNames,
  creator,
};
```

### Example 2: DailyContentData Type Update
```typescript
// Source: src/hooks/useDailyContent.ts lines 13-27
// Add devotional_reflection to the interface

export interface DailyContentData {
  id: number;
  post_date: string;
  mode: 'bible' | 'positivity';
  language: 'en' | 'es';
  title: string;
  content_text: string;
  verse_reference: string | null;
  chapter_reference: string | null;
  video_background_url: string;
  lumashort_video_url: string | null;
  devotional_reflection: string | null;  // ADD THIS
  translations: Array<{ code: string; text: string; audio_url: string | null; audio_srt_url: string | null; chapter_text: string | null }>;
  translation_names: Record<string, string>;
  creator?: DailyContentCreator | null;
}
```

### Example 3: DevotionalSlide Component Structure
```typescript
// New component: src/components/daily/DevotionalSlide.tsx
// Simplified version of DailyPostSlide: video bg + text + share button only

interface DevotionalSlideProps {
  content: DailyContentData;
  isActive?: boolean;
}

export function DevotionalSlide({ content, isActive = true }: DevotionalSlideProps) {
  const bgVideoRef = useRef<HTMLVideoElement>(null);

  // Same video background pattern as DailyPostSlide
  // Gradient overlay for text readability
  // Centered reflection text with appropriate typography
  // Single ShareButton at the bottom

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Video bg + gradient + text + share button */}
    </div>
  );
}
```

### Example 4: Carousel Integration with Dynamic Index Calculation
```typescript
// Source: src/components/daily/DailyPostCarousel.tsx CarouselSwiper function
// Key change: calculate slide indices dynamically

const hasDevotional = content.mode === 'bible' &&
  !!content.devotional_reflection?.trim();

// Dynamic index calculation
const devotionalIndex = hasDevotional ? 1 : -1;
const audioIndex = hasDevotional ? 2 : 1;
const lumaShortIndex = hasDevotional ? 3 : 2;

// In slideContent useMemo deps, add content.devotional_reflection
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed 3-slide carousel | Conditional 3-4 slide carousel | Phase 16 | Bible mode can show devotional when available |
| devotional_reflection internal only | Exposed in API + rendered in UI | Phase 16 | Content pipeline output becomes user-visible |

**Important context:**
- The `devotional_reflection` field exists in the DB but is currently populated for 0 out of 238 bible-mode rows in dev. The content pipeline (`pipeline-runner.ts`) generates it when run. Once this phase ships, running the pipeline will populate the field and the slides will automatically appear.
- The LumaShortSlide shows a "Not Available" placeholder when `lumashort_video_url` is null. Per user decision, the devotional slide should NOT show any placeholder -- it simply skips.

## Open Questions

1. **Devotional text length variability**
   - What we know: The AI generates devotional reflections of varying lengths. The `devotional_reflection` field is TEXT type (unlimited).
   - What's unclear: Typical length range of generated reflections -- are they 1-2 sentences or full paragraphs?
   - Recommendation: Design typography to handle both short (1-2 sentences) and long (full paragraph) reflections gracefully. Use dynamic font sizing similar to ShareButton's approach (smaller font for longer text). Add vertical scrollability as a safety net for very long reflections, or truncate at a reasonable limit.

2. **Share image design for devotional vs verse**
   - What we know: ShareButton draws verse text in italic Georgia with a reference line below. Devotional reflections are not verses -- they are commentary.
   - What's unclear: Should the share image for devotional reflections look different from verse share images?
   - Recommendation: Use the same ShareButton component but pass `null` for reference. The branding footer stays the same. Consider using non-italic font for the devotional text to visually distinguish it from verse quotes. This is within Claude's discretion.

3. **Video readiness synchronization between slides**
   - What we know: DailyPostSlide has a video preload mechanism (`videoReady` state, `onCanPlay` handler, loading spinner). The DevotionalSlide will load the same URL.
   - What's unclear: Will the browser cache the video so DevotionalSlide loads instantly?
   - Recommendation: Implement the same `videoReady`/`onCanPlay` pattern in DevotionalSlide. The browser should cache the video since both slides use the same URL, but include the loading spinner as a safety net.

## Sources

### Primary (HIGH confidence)
- `src/components/daily/DailyPostCarousel.tsx` - Current carousel structure (264 lines)
- `src/components/daily/DailyPostSlide.tsx` - Verse slide with video background pattern (330 lines)
- `src/components/daily/LumaShortSlide.tsx` - Conditional slide precedent (164 lines)
- `src/components/daily/AudioPlayerSlide.tsx` - Audio slide structure (340 lines)
- `src/components/daily/ShareButton.tsx` - Share image generation (247 lines)
- `src/hooks/useDailyContent.ts` - DailyContentData type definition (249 lines)
- `src/lib/db/models/DailyContent.ts` - Sequelize model with devotional_reflection field
- `src/app/api/daily-posts/route.ts` - Today's daily content API (does NOT include devotional_reflection)
- `src/app/api/daily-posts/[date]/route.ts` - Date-specific API (does NOT include devotional_reflection)
- `src/app/api/daily-posts/feed/route.ts` - Feed API (does NOT include devotional_reflection)
- `src/lib/content-pipeline/pipeline-runner.ts` - Generates devotional_reflection for bible mode

### Secondary (MEDIUM confidence)
- DB query: 476 daily_content rows, 238 bible mode, 0 currently have devotional_reflection populated

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all existing libraries
- Architecture: HIGH - All patterns are direct extensions of existing code with clear precedents
- Pitfalls: HIGH - All identified from reading the actual source code

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- no external dependencies to go stale)
