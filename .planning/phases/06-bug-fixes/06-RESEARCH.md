# Phase 6: Bug Fixes & Polish - Research

**Researched:** 2026-02-14
**Domain:** Next.js 16 / React 19 bug fixing across daily content, feed, prayer wall, and media modules
**Confidence:** HIGH

## Summary

Phase 6 is a bug-fixing phase with no new libraries or features. The codebase is a Next.js 16.1.6 / React 19 application using Sequelize ORM, Backblaze B2 storage with Cloudflare CDN, and a custom TikTok/Instagram dual-mode feed.

A `next build` reveals exactly **one TypeScript compile error** (audit-log route type casting). All 14 user-reported bugs have been investigated with root causes identified or strongly hypothesized. The bugs range from trivial one-line fixes (TypeScript cast, API field mismatch) to moderate-complexity UI/UX fixes (scroll snap for guests, video tap-to-pause overlay conflict).

**Primary recommendation:** Fix the single build error first, then address bugs module-by-module in priority order: Prayer Wall (most bugs, includes API field mismatch), Feed (gesture/overlay conflicts), Daily Content (guest scroll snap), Prayer Composer (theme + simplify), and finally media caching audit.

## Standard Stack

No new dependencies required. All fixes use the existing stack:

### Core (Already Installed)
| Library | Version | Purpose | Relevance |
|---------|---------|---------|-----------|
| Next.js | 16.1.6 | App framework | Build error fix, route handlers |
| React | 19.x | UI library | Component fixes, event handling |
| Sequelize | 6.x | ORM | Prayer API fixes |
| Tailwind CSS | 4.x | Styling | Theme fixes, scroll snap |
| Swiper | (installed) | Horizontal carousels | Daily post, media carousel |
| Lucide React | (installed) | Icons | Heart outline default icon |
| next-themes | (installed) | Theme management | Prayer composer theme fix |

### Supporting (Already Installed)
| Library | Purpose | When Referenced |
|---------|---------|----------------|
| Zod | Schema validation | Prayer API field fix |
| @aws-sdk/client-s3 | B2 uploads | Video thumbnail generation |

### No New Libraries Needed
This phase is strictly bug-fixing. All fixes use existing patterns and libraries.

## Architecture Patterns

### Existing Project Structure (Relevant Files)
```
src/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx           # GuestDailyWrapper (bug #1)
│   │   ├── page.tsx             # Daily feed entry
│   │   ├── prayer-wall/page.tsx # Prayer wall page (bugs #6-10)
│   │   └── daily/[date]/page.tsx
│   └── api/
│       ├── feed/route.ts        # Following feed API
│       ├── feed/fyp/route.ts    # FYP feed API (missing user_reposted)
│       ├── prayer-requests/
│       │   ├── route.ts         # Prayer list + create
│       │   └── [id]/route.ts    # Prayer update (mark_answered bug)
│       ├── upload/post-media/route.ts # Media upload
│       └── admin/audit-log/route.ts   # Build error
├── components/
│   ├── daily/DailyFeed.tsx       # Daily feed scroll (bug #1)
│   ├── feed/
│   │   ├── PostCardTikTok.tsx    # TikTok card (bugs #2-5)
│   │   ├── PostCardInstagram.tsx # Instagram card (bugs #4-5)
│   │   ├── PostFeed.tsx          # Feed container
│   │   ├── MediaCarousel.tsx     # Horizontal swipe carousel
│   │   └── PostComposer.tsx      # Post creation (bug #5)
│   ├── prayer/
│   │   ├── PrayerCard.tsx        # Prayer card (bugs #6-10)
│   │   └── PrayerComposer.tsx    # Prayer composer (bugs #11-13)
│   └── layout/
│       └── AppShell.tsx          # Scroll snap container
├── hooks/
│   ├── usePrayerWall.ts          # Prayer state (bug #8, #10)
│   └── usePostReactions.ts       # Reaction state (bug #6)
├── context/
│   └── ImmersiveContext.tsx       # Immersive mode state
└── lib/
    └── storage/
        ├── b2.ts                 # B2 config + CDN URL (bug #14)
        └── presign.ts            # Presigned URL generation
```

### Pattern 1: Guest vs Authenticated Layout
**What:** `GuestDailyWrapper` wraps daily content for unauthenticated users; `AppShellInner` wraps for authenticated users.
**Key difference:** AppShellInner applies `scrollSnapType: 'y mandatory'` on the `#immersive-scroll` container. GuestDailyWrapper does NOT.
**Fix pattern:** Add matching scroll snap styling to GuestDailyWrapper's `<main>` element and give it the `id="immersive-scroll"`.

### Pattern 2: Feed API Response Shape
**What:** Feed APIs (feed, fyp) format post data with author info, media, reactions, bookmarks, reposts.
**Key issue:** FYP route omits `user_reposted` field that Following route includes.
**Fix pattern:** Add `user_reposted` to FYP response matching Following route pattern.

### Pattern 3: Overlay z-index Layering in TikTok Cards
**What:** PostCardTikTok uses absolute positioning with z-index layers:
- z-0: Media carousel (video, images)
- z-10: Content overlay (author info, text, action buttons)
- z-20: Interactive elements (mute button, action stack)
**Key issue:** The z-10 content overlay blocks click events from reaching the video element.
**Fix pattern:** Add `pointer-events-none` to the content overlay, then `pointer-events-auto` on interactive children. Or add a tap handler on the overlay background area.

### Pattern 4: Prayer API Request Schema
**What:** Server uses Zod schema with `action: z.enum(['mark_answered'])`. Client sends `mark_answered: true`.
**Fix pattern:** Either change client to send `action: 'mark_answered'` or change server schema to accept `mark_answered: z.boolean()`.

### Anti-Patterns to Avoid
- **Hardcoded dark theme colors in fullscreen modals:** PrayerComposer uses `bg-gray-950/95` and `text-white` regardless of theme context. Should use theme-aware CSS variables or respect data-theme attribute.
- **Separate Camera + Gallery buttons on mobile:** On mobile, both open the OS media picker anyway. Simpler UX: one "Photo/Video" button.
- **Video preview without thumbnail generation:** Uploading videos to B2 without generating a poster frame. The `<video preload="metadata">` approach doesn't reliably show a thumbnail on all browsers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video thumbnail | Server-side FFmpeg | Client-side canvas capture from `<video>` element | Can capture first frame via `video.currentTime + canvas.toDataURL()` before upload. Simple, no server dependency. |
| Scroll snap for guests | Custom JS scroll position tracking | CSS `scroll-snap-type: y mandatory` on container | Already works for authenticated users. Same CSS needed for guest wrapper. |
| Media gesture conflict | Custom touch event system | CSS `touch-action: pan-x` on horizontal carousel, `touch-action: pan-y` on vertical feed | Browser-native gesture separation. Combine with proper `overflow` directions. |

**Key insight:** Most bugs are CSS/HTML attribute gaps or client-server field mismatches, not architectural problems requiring new solutions.

## Common Pitfalls

### Pitfall 1: z-index Overlay Blocking Touch Events
**What goes wrong:** Absolute-positioned overlay divs intercept touch/click events meant for elements underneath.
**Why it happens:** A `<div>` covering the video with z-index > 0 captures events by default.
**How to avoid:** Use `pointer-events-none` on the overlay container, then `pointer-events-auto` on child elements that need interactivity. Or add an explicit tap handler on the overlay that delegates to the video.
**Warning signs:** Tap/click handlers on elements behind overlays stop working.

### Pitfall 2: Client-Server Field Name Mismatch
**What goes wrong:** Client sends `{ mark_answered: true }` but server Zod schema expects `{ action: 'mark_answered' }`. Zod strips unknown fields, so the action never triggers.
**Why it happens:** Frontend and backend developed independently without end-to-end testing of the mark-answered flow.
**How to avoid:** After fixing, verify with a manual test: create prayer, mark answered, check DB and UI.
**Warning signs:** API returns 200 but no state change occurs.

### Pitfall 3: CSS Scroll Snap Requires Container Properties
**What goes wrong:** Child elements have `snap-start` but no vertical snapping occurs.
**Why it happens:** The parent container is missing `scroll-snap-type: y mandatory` and/or `overflow-y: auto`.
**How to avoid:** Scroll snap requires BOTH container properties (`scroll-snap-type`) AND child properties (`scroll-snap-align`).
**Warning signs:** Content scrolls freely without snapping between items.

### Pitfall 4: Video Thumbnail from preload="metadata"
**What goes wrong:** `<video preload="metadata">` supposed to show first frame as poster, but shows black/empty on many mobile browsers.
**Why it happens:** Browsers don't guarantee rendering a video frame when only preloading metadata. iOS Safari and some Android browsers won't decode video frames until playback starts.
**How to avoid:** Generate a thumbnail at upload time: either client-side (seek video to 0.5s, draw to canvas, upload canvas blob) or set `poster` attribute with a generated thumbnail URL.
**Warning signs:** Video preview shows black rectangle instead of first frame.

### Pitfall 5: Horizontal Swipe Inside Vertical Scroll-Snap Container
**What goes wrong:** Horizontal swipe gestures on media carousel get intercepted by vertical scroll snap.
**Why it happens:** The vertical scroll container (`#immersive-scroll`) with `scroll-snap-type: y mandatory` and `overscrollBehaviorY: contain` aggressively captures touch moves. Any slight vertical component in a horizontal swipe triggers vertical scroll snap instead.
**How to avoid:** Use `touch-action: pan-x` on the horizontal carousel to tell the browser this element only handles horizontal gestures. This lets the browser route vertical gestures to the parent scroll container and horizontal gestures to the carousel.
**Warning signs:** Carousel swipe stutters or gets cancelled; vertical scroll triggers during horizontal gesture.

### Pitfall 6: Refreshing Feed After Prayer Creation
**What goes wrong:** After creating a prayer on the "Others" tab, `refresh()` re-fetches the Others tab which excludes the user's own prayers. User doesn't see their new prayer.
**Why it happens:** The "Others" tab query has `user_id NOT IN [userId]`. The new prayer is the user's own.
**How to avoid:** After successful creation, either auto-switch to "My Requests" tab, or prepend the newly created prayer to the local state optimistically.
**Warning signs:** User creates content but it doesn't appear in the current view.

## Code Examples

### Fix 1: Build Error — Type Cast in Audit Log Route
**File:** `src/app/api/admin/audit-log/route.ts:92`
**Problem:** `entry.toJSON() as Record<string, unknown>` fails because Sequelize model types don't have index signatures.
**Fix:**
```typescript
// Before (fails)
const json = entry.toJSON() as Record<string, unknown>;

// After (works)
const json = entry.toJSON() as unknown as Record<string, unknown>;
```

### Fix 2: Guest Scroll Snap — GuestDailyWrapper
**File:** `src/app/(app)/layout.tsx` (GuestDailyWrapper component)
**Problem:** Missing scroll snap properties on guest layout container.
**Fix:**
```tsx
function GuestDailyWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="relative fixed inset-0 overflow-hidden bg-black">
      <main
        id="immersive-scroll"
        className="h-full overflow-y-auto"
        style={{ scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain' }}
      >
        {children}
      </main>
      {/* Sign up / Sign in CTA overlay at bottom */}
      {/* ... CTA stays the same but with z-40 ... */}
    </div>
  );
}
```

### Fix 3: Video Tap-to-Pause — PostCardTikTok Overlay
**File:** `src/components/feed/PostCardTikTok.tsx`
**Problem:** Content overlay at z-10 blocks clicks from reaching video element.
**Fix:** Add click handler to the overlay background or use pointer-events-none + pointer-events-auto pattern:
```tsx
{/* Content overlay */}
<div
  className="absolute inset-x-0 top-0 z-10 pointer-events-none"
  style={{ height: '100svh' }}
>
  {/* All interactive children get pointer-events-auto */}
  <div className="pointer-events-auto ...">
    {/* action buttons, author info, etc. */}
  </div>
</div>

{/* Separate tap-to-toggle layer behind the overlay */}
{activeIsVideo && (
  <button
    type="button"
    onClick={togglePlayPause}
    className="absolute inset-0 z-[5]"
    aria-label="Toggle play/pause"
  />
)}
```

### Fix 4: Mark Answered — Client-Server Field Mismatch
**File:** `src/components/prayer/PrayerCard.tsx` (handleMarkAnswered)
**Problem:** Client sends `{ mark_answered: true }` but server expects `{ action: 'mark_answered' }`.
**Fix:**
```typescript
// Before
body: JSON.stringify({
  mark_answered: true,
  testimony: testimonyInput.trim() || undefined,
}),

// After
body: JSON.stringify({
  action: 'mark_answered',
  testimony: testimonyInput.trim() || undefined,
}),
```

### Fix 5: Video Upload Thumbnail — Client-Side Canvas Capture
**Pattern for generating a thumbnail from a video file before upload:**
```typescript
async function generateVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      video.currentTime = 0.5; // Seek to 0.5s for a representative frame
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob);
      }, 'image/jpeg', 0.7);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}
```
This thumbnail blob can then be uploaded alongside the video, and the `thumbnail_url` set on the PostMedia record.

### Fix 6: Prayer Composer Theme
**File:** `src/components/prayer/PrayerComposer.tsx`
**Problem:** Hardcoded `bg-gray-950/95` and `text-white` ignoring theme.
**Fix:** Use theme-aware classes:
```tsx
// Before
<div className="fixed inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-xl">

// After — use theme variables
<div className="fixed inset-0 z-50 flex flex-col bg-surface/95 dark:bg-gray-950/95 backdrop-blur-xl">
```
Apply same pattern to all hardcoded white/dark colors in the composer.

### Fix 7: Simplify Prayer Composer Media Picker
**File:** `src/components/prayer/PrayerComposer.tsx`
**Problem:** Separate Camera and Gallery buttons. Should be single "Photo/Video" button.
**Fix:** Replace two buttons with one that uses `accept="image/*,video/*"` (no `capture` attribute, which lets the OS show both camera and gallery options):
```tsx
<button
  type="button"
  onClick={() => fileInputRef.current?.click()}
  disabled={media.length >= MAX_MEDIA}
  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ..."
>
  <ImageIcon className="h-4 w-4" />
  <span>Photo/Video</span>
</button>
{/* Single hidden input — no capture attribute = shows both camera + gallery */}
<input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
  multiple
  className="hidden"
  onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }}
/>
```
Remove the `cameraInputRef` and its `<input capture="environment">`.

### Fix 8: Default Prayer Reaction Icon
**File:** `src/components/prayer/PrayerCard.tsx`
**Problem:** Default reaction icon is prayer emoji `&#x1F64F;`. Should be outlined heart.
**Fix:**
```tsx
// Before (line 382)
<span className="text-base">&#x1F64F;</span>

// After — use Heart outline icon (consistent with feed)
<Heart className="h-5 w-5" />
```

## State of the Art

No version changes or technology shifts relevant to this phase. All fixes use existing patterns.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | N/A | N/A | N/A |

## Bug-by-Bug Root Cause Analysis

### Bug 1: Guest Snap Scroll Broken
**Root cause:** `GuestDailyWrapper` in `src/app/(app)/layout.tsx` uses `<main className="flex-1">` without scroll snap properties. The authenticated `AppShellInner` applies `scrollSnapType: 'y mandatory'` and `id="immersive-scroll"` on its `<main>`, but the guest wrapper does not.
**Confidence:** HIGH — verified by reading both wrappers side-by-side.
**Fix complexity:** LOW — add matching CSS properties to GuestDailyWrapper.

### Bug 2: Media Carousel Swipe Blocked (TikTok Mode)
**Root cause:** The horizontal media carousel in `PostCardTikTok` (`overflow-x-auto snap-x snap-mandatory`) is nested inside the vertical `#immersive-scroll` container (`scrollSnapType: 'y mandatory'`). Touch gestures get captured by the vertical scroller before the horizontal carousel can process them. The media carousel div (line 241-278) needs `touch-action: pan-x` to explicitly claim horizontal gestures.
**Confidence:** HIGH — this is a well-documented CSS touch-action pattern. The vertical container's `overscrollBehaviorY: contain` further contributes to gesture capture.
**Fix complexity:** LOW-MEDIUM — add `touch-action: pan-x` to horizontal carousel, possibly also `touch-action: pan-y` to the parent container.

### Bug 3: Video Tap-to-Pause Does Nothing (TikTok Feed)
**Root cause:** The content overlay div at `PostCardTikTok.tsx:299` (`className="absolute inset-x-0 top-0 z-10"`) covers the entire card at z-index 10, blocking click events from reaching the `<video>` element (z-index 0) which has `onClick={togglePlayPause}`. The overlay has no click handler of its own.
**Confidence:** HIGH — verified by tracing the z-index stack and event propagation.
**Fix complexity:** MEDIUM — need to restructure the overlay to use `pointer-events-none` on the container with `pointer-events-auto` on interactive children, or add a dedicated tap-to-toggle button layer between the video and the overlay.

### Bug 4: Repost Verified Badges Missing
**Root cause:** Looking at `PostCardTikTok.tsx` and `PostCardInstagram.tsx`, both DO render verified badges for repost authors:
- TikTok line 471: `{author.is_verified && <VerifiedBadge .../>}` in repost indicator
- TikTok line 526: `{post.original_post.author.is_verified && <VerifiedBadge .../>}` in original post card
- Instagram line 286: `{post.original_post.author.is_verified && <VerifiedBadge .../>}`

However, for TikTok repost posts, the `author` info line (line 476-486) is skipped entirely when `isRepost` is true (`!isRepost && (...)` condition on line 476). The reposter's name and badge only appear in the small "reposted" indicator. The `is_verified` field IS included in both feed APIs (line 99 in feed/route.ts, line 108 in fyp/route.ts, and original post author line 180/322).

The actual issue might be that the FYP API is missing `user_reposted` from the response (confirmed: FYP route line 376 has no `user_reposted`), which could affect how reposts are displayed.

**Confidence:** MEDIUM — the frontend code does render badges; the issue may be subtle (wrong context, specific API response missing field, or the `is_verified` is not returned in a specific edge case). Needs runtime verification.
**Fix complexity:** LOW — add `user_reposted` to FYP response, verify badge rendering end-to-end.

### Bug 5: Video Upload No Thumbnail (Feed + Prayer)
**Root cause:** The `PostComposer` (feed) upload flow generates a `MediaItem` with no `thumbnail_url` for videos. The `uploadFile` function (PostComposer line 472-558) creates a local preview via `URL.createObjectURL(file)` but never generates or uploads a thumbnail image. When the upload completes (line 532-538), `thumbnail_url` is not set. The video element in `MediaStrip` (line 268) uses `<video src={item.url} preload="metadata">` which doesn't reliably show a frame on all browsers.

Same issue in `PrayerComposer` (line 425-439): video preview uses `<video src={m.previewUrl} preload="metadata">` — no poster/thumbnail.

The server upload endpoint (`/api/upload/post-media`) doesn't do server-side thumbnail generation either — it just stores the raw file in B2.

**Confidence:** HIGH — confirmed by tracing the full upload flow from composer to B2. No thumbnail generation exists anywhere.
**Fix complexity:** MEDIUM — need client-side canvas capture (see Code Examples section) integrated into the upload flow, plus uploading the thumbnail blob and setting `thumbnail_url`.

### Bug 6: Prayer Reaction Not Highlighted
**Root cause:** The `PrayerCard` uses `usePostReactions` which tracks `userReaction` state correctly. When the user selects a reaction:
1. `reactionTotal` goes from 0 to 1
2. The card switches from the static prayer emoji button to `PostReactionBar`
3. `PostReactionBar` shows overlapping emoji icons with a subtle `bg-primary/10` highlight when `userReaction` is set

The "not highlighted" perception likely comes from the `PostReactionBar` highlight being too subtle — just a light `bg-primary/10` background and no visual indicator on the individual emoji showing which one the user selected. The overlapping emoji display doesn't distinguish the user's reaction from others.

**Confidence:** MEDIUM — the code does highlight, but the visual feedback is subtle. Runtime testing needed to confirm this is the perceived issue.
**Fix complexity:** LOW — add a more visible highlight (ring, scale, glow) to the user's reaction type in PostReactionBar, or add a checkmark/highlight to the selected emoji.

### Bug 7: Prayer Video Not Loading
**Root cause:** The `PrayerCard` renders videos with `<video src={m.url} controls preload="metadata">` (line 351-356). The `preload="metadata"` means the video doesn't start downloading content until the user interacts. Combined with the fact that no `poster` attribute is set (no thumbnail URL), the video shows as a blank/black rectangle.

The B2 URL is a CDN URL (via `CDN_BASE_URL`). If Cloudflare cache rules are not configured for video files, each video request goes to B2 origin which may be slow or fail depending on connection.

**Confidence:** HIGH for the thumbnail issue; MEDIUM for the loading issue (could also be CORS or B2 bucket config).
**Fix complexity:** LOW-MEDIUM — add `poster={m.thumbnail_url}` (requires bug #5 fix first for thumbnail generation), change `preload` to `auto` or `none`, ensure video controls are visible.

### Bug 8: New Prayer Request Not Appearing
**Root cause:** After creating a prayer from `PrayerComposer`, the `onSubmit` callback triggers `refresh()` in `usePrayerWall` which re-fetches the CURRENT tab. If the user is on the "Others" tab (default), the API query excludes the user's own prayers (`user_id NOT IN [userId]`). So the new prayer won't appear. The user must manually switch to "My Requests" tab.

**Confidence:** HIGH — verified by reading the API query logic (prayer-requests route.ts lines 132-139) and the hook's refresh flow.
**Fix complexity:** LOW — after successful creation, auto-switch to "My Requests" tab, or optimistically prepend the new prayer to local state.

### Bug 9: Default Reaction Should Be Heart Outline
**Root cause:** `PrayerCard.tsx` line 382 uses a prayer hands emoji (`&#x1F64F;`) as the default reaction icon. User requests an outlined heart icon instead, consistent with the feed's `<Heart>` icon.
**Confidence:** HIGH — this is a simple UI change.
**Fix complexity:** LOW — replace the emoji with `<Heart className="h-5 w-5" />` from lucide-react.

### Bug 10: Answered Prayers Not Showing
**Root cause:** **Client-server field mismatch.** The `PrayerCard` sends `{ mark_answered: true, testimony: ... }` (line 139-141) but the API Zod schema expects `{ action: 'mark_answered', testimony: ... }` (line 33 of `[id]/route.ts`). Since `mark_answered` is not in the schema, Zod strips it. The `action` field remains `undefined`, so the `if (action === 'mark_answered')` check (line 200) never triggers. The prayer is never actually updated to "answered" status in the database.

**Confidence:** HIGH — directly verified by comparing client payload to server schema.
**Fix complexity:** LOW — change client to send `action: 'mark_answered'` instead of `mark_answered: true`.

### Bug 11: Simplify Prayer Media Picker
**Root cause:** `PrayerComposer` has two separate buttons: "Camera" (line 473-482, opens `cameraInputRef` with `capture="environment"`) and "Gallery" (line 483-492, opens `fileInputRef`). User wants a single "Photo/Video" button.
**Confidence:** HIGH — straightforward UI change.
**Fix complexity:** LOW — merge into single button, remove cameraInputRef and its input element.

### Bug 12: Prayer Composer Theme Not Respected
**Root cause:** `PrayerComposer` uses hardcoded dark theme colors: `bg-gray-950/95`, `text-white`, `border-white/10`, etc. These are applied regardless of the user's theme setting because the component doesn't use theme-aware CSS variables or Tailwind dark: variants properly.
**Confidence:** HIGH — verified by reading the component (line 332 onwards).
**Fix complexity:** MEDIUM — need to replace all hardcoded dark colors with theme-aware equivalents (`bg-surface`, `text-text`, `border-border`, etc.) and add `dark:` variants.

### Bug 13: Prayer Composer Video Upload No Thumbnail
**Root cause:** Same as Bug #5. The `PrayerComposer` uses `<video src={m.previewUrl} preload="metadata">` (line 427-429) for the video preview, which doesn't reliably show a frame. No thumbnail generation occurs during upload.
**Confidence:** HIGH — same root cause as Bug #5.
**Fix complexity:** MEDIUM — same fix as Bug #5 (client-side canvas thumbnail generation).

### Bug 14: Media Caching Investigation
**Root cause:** The Cloudflare CDN checklist (`CLOUDFLARE_CHECKLIST.md`) shows multiple unconfigured items:
1. **No Cache-Control headers on B2 uploads:** The upload endpoint (`/api/upload/post-media`) stores files in B2 without setting `CacheControl` on the `PutObjectCommand`. B2 serves files with default headers.
2. **Cloudflare dashboard items unchecked:** CNAME record, cache rules, edge TTL, browser TTL, and Polish are all marked as TODO.
3. **No `CacheControl` in PutObjectCommand:** The `PutObjectCommand` (upload route line 134-141) only sets `Bucket`, `Key`, `Body`, and `ContentType` — no `CacheControl` parameter.

**Fix approach:**
- Add `CacheControl: 'public, max-age=31536000, immutable'` to the `PutObjectCommand` for immutable uploads (post media, avatars).
- Document the Cloudflare dashboard configuration needed (this is ops, not code).
- Verify `CDN_BASE_URL` is properly configured and serving via Cloudflare.

**Confidence:** HIGH for code-level changes; MEDIUM for Cloudflare dashboard (requires manual ops).
**Fix complexity:** LOW for adding CacheControl header; ops work for Cloudflare dashboard.

## Open Questions

1. **Bug #4 (Repost verified badges) runtime verification needed**
   - What we know: Frontend code DOES render verified badges for repost authors in both TikTok and Instagram modes. APIs include `is_verified` field.
   - What's unclear: Whether the bug is about a specific repost scenario not covered, or whether the FYP route's missing `user_reposted` causes a display issue.
   - Recommendation: Add `user_reposted` to FYP route, then do runtime testing to verify badge display.

2. **Bug #7 (Prayer video not loading) — CORS/B2 config**
   - What we know: Code renders `<video>` with B2 CDN URL and `preload="metadata"`.
   - What's unclear: Whether the video fails to load due to missing thumbnail, slow CDN, or CORS issues with B2.
   - Recommendation: Fix thumbnail generation first (Bug #5), then test video loading. If still broken, check B2 CORS rules and Cloudflare proxy settings.

3. **Bug #2 (Carousel swipe) — exact touch-action fix**
   - What we know: Vertical scroll snap container intercepts horizontal swipe gestures.
   - What's unclear: Whether `touch-action: pan-x` alone is sufficient or if additional gesture handling is needed.
   - Recommendation: Apply `touch-action: pan-x` on the media carousel and test on iOS Safari + Chrome Android.

## Sources

### Primary (HIGH confidence)
- Codebase direct reading — all files referenced above
- `npx next build` output — single TypeScript error confirmed
- `.planning/CLOUDFLARE_CHECKLIST.md` — media caching status

### Secondary (MEDIUM confidence)
- CSS `scroll-snap-type` and `touch-action` behavior — based on established CSS spec knowledge
- Client-side video thumbnail generation via canvas — well-documented browser API pattern

### Tertiary (LOW confidence)
- None — all findings are code-level verified

## Metadata

**Confidence breakdown:**
- Build error: HIGH — single error, exact line/fix known
- Bug root causes: HIGH — 12 of 14 bugs have verified root causes
- Bug #4 (repost badges): MEDIUM — code looks correct, runtime verification needed
- Bug #7 (prayer video): MEDIUM — multiple possible causes
- Media caching: HIGH for code audit, MEDIUM for ops recommendations

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable codebase, no external dependencies changing)
