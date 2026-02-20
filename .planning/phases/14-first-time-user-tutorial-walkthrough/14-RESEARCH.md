# Phase 14: First-Time User Tutorial & Walkthrough - Research

**Researched:** 2026-02-20
**Domain:** React onboarding UI / Coach marks / CSS spotlight overlays
**Confidence:** HIGH

## Summary

This phase implements a two-phase first-time user tutorial: a 4-card slideshow introduction followed by contextual coach marks on the real daily feed. The codebase already contains all necessary building blocks -- Swiper for carousels, createPortal for overlays, the Modal pattern for dimmed backdrops, and the User model for persistence.

The research confirms that a **custom implementation** is the correct approach rather than using a library like react-joyride. React-joyride is not compatible with React 19 (which this project uses at 19.2.3), uses inline styles incompatible with Tailwind, and cannot handle the project's async element loading or full-screen immersive layout. The codebase already has extensive overlay/portal patterns that make a custom solution straightforward.

The core technical challenge is the coach mark spotlight cutout effect. The recommended technique uses CSS `box-shadow` with a massive spread radius on a positioned element over the target, creating a transparent hole in a dark overlay. This avoids the complexity of SVG masks or clip-path and works reliably on mobile Safari.

**Primary recommendation:** Build custom slideshow + coach mark components using existing Swiper (slideshow) and createPortal (overlays) patterns. Track tutorial state via `has_seen_tutorial` boolean on the users table. No new dependencies needed.

## Standard Stack

The established libraries/tools for this domain:

### Core (already installed -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| swiper | ^12.1.0 | Slideshow carousel with horizontal swipe | Already used in DailyPostCarousel; proven pattern |
| react-dom createPortal | 19.2.3 | Overlay rendering outside component tree | Used in 23 components; established escape-hatch pattern |
| lucide-react | ^0.563.0 | Icons for slideshow cards | Already used everywhere |
| sequelize | ^6.37.7 | DB migration for has_seen_tutorial column | Standard migration pattern |

### Supporting (already installed -- no new dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cn (clsx + tailwind-merge) | project util | Conditional class merging | All tutorial UI elements |
| next/navigation | 16.1.6 | Router for replay navigation | Settings replay button |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom coach marks | react-joyride | Not React 19 compatible; inline styles; overkill for 4 steps |
| Custom coach marks | react-coach-mark | Low download count (400/week); small library; not worth dependency |
| Custom slideshow | Standalone intro.js | Heavy; adds 30KB for 4 slides; Swiper already installed |
| CSS box-shadow cutout | SVG mask overlay | More complex; harder to animate; not needed for rounded-rect cutouts |

**Installation:**
```bash
# No new packages needed. All tools already in the project.
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    tutorial/
      TutorialProvider.tsx      # Context provider + trigger logic
      TutorialSlideshow.tsx     # 4-card Swiper slideshow (createPortal)
      TutorialCoachMarks.tsx    # Coach mark overlay system (createPortal)
      tutorialSteps.ts          # Step definitions (target selectors, text, positioning)
  app/
    (app)/
      layout.tsx                # Add TutorialProvider wrapper
    api/
      tutorial/
        route.ts                # GET has_seen_tutorial, PUT to mark complete
  lib/
    db/
      migrations/
        100-add-has-seen-tutorial-to-users.cjs
      models/
        User.ts                 # Add has_seen_tutorial field
```

### Pattern 1: TutorialProvider Context
**What:** A React context provider wrapping the authenticated app shell that checks `has_seen_tutorial` and orchestrates the two-phase flow.
**When to use:** Always -- wraps the AppShell inside the authenticated layout.
**Example:**
```typescript
// TutorialProvider.tsx
interface TutorialContextValue {
  showTutorial: boolean;
  phase: 'slideshow' | 'coach-marks' | 'done';
  currentStep: number;
  totalSteps: number;
  advance: () => void;
  skip: () => void;
  replay: () => void;
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const pathname = usePathname();
  const [phase, setPhase] = useState<'idle' | 'slideshow' | 'coach-marks' | 'done'>('idle');

  // Check on mount: if user hasn't seen tutorial AND we're on daily feed
  useEffect(() => {
    if (!user || user.has_seen_tutorial) return;
    // Only trigger on the daily feed page (/ route)
    if (pathname !== '/') return;
    // Wait for feed to load before starting
    const timer = setTimeout(() => setPhase('slideshow'), 500);
    return () => clearTimeout(timer);
  }, [user, pathname]);

  const advance = useCallback(() => {
    if (phase === 'slideshow') setPhase('coach-marks');
    else if (phase === 'coach-marks') completeTutorial();
  }, [phase]);

  const skip = useCallback(() => completeTutorial(), []);

  const completeTutorial = async () => {
    setPhase('done');
    await fetch('/api/tutorial', { method: 'PUT', credentials: 'include' });
    await refreshUser();
  };

  return (
    <TutorialContext.Provider value={{ ... }}>
      {children}
      {phase === 'slideshow' && <TutorialSlideshow onComplete={() => setPhase('coach-marks')} onSkip={skip} />}
      {phase === 'coach-marks' && <TutorialCoachMarks onComplete={() => completeTutorial()} onSkip={skip} />}
    </TutorialContext.Provider>
  );
}
```

### Pattern 2: Coach Mark Spotlight via CSS box-shadow
**What:** Position a transparent element over the target, then use a massive box-shadow spread to darken everything else. The element itself remains transparent (the "cutout").
**When to use:** Each coach mark step.
**Example:**
```typescript
// Coach mark spotlight technique
function Spotlight({ targetRect, padding = 8 }: { targetRect: DOMRect; padding?: number }) {
  const borderRadius = 12; // rounded-rect cutout

  return createPortal(
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ transition: 'opacity 300ms ease' }}
    >
      {/* The cutout element: transparent box with huge box-shadow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: targetRect.top - padding,
          left: targetRect.left - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          borderRadius: `${borderRadius}px`,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
        }}
      />

      {/* Tooltip positioned relative to target */}
      <div
        className="absolute pointer-events-auto"
        style={{
          // Position tooltip below/above based on available space
          top: targetRect.bottom + padding + 12,
          left: targetRect.left,
        }}
      >
        {/* Tooltip content */}
      </div>
    </div>,
    document.body
  );
}
```

### Pattern 3: Target Element Resolution via data attributes
**What:** Coach mark steps reference target elements via data-tutorial attributes, not CSS selectors or refs.
**When to use:** When defining which UI elements to spotlight.
**Example:**
```typescript
// In BottomNav.tsx - add data attributes
<nav data-tutorial="bottom-nav" ...>

// In DailyPostSlide.tsx - add data attribute to reaction area
<div data-tutorial="reactions-area" ...>

// In VerseModeToggle.tsx
<button data-tutorial="verse-toggle" ...>

// tutorialSteps.ts
export const COACH_MARK_STEPS = [
  {
    target: '[data-tutorial="daily-card"]',
    title: 'Swipe Up for More',
    description: 'Swipe up to discover content from previous days.',
    position: 'center', // animated gesture hint, not tooltip
    showSwipeAnimation: true,
  },
  {
    target: '[data-tutorial="verse-toggle"]',
    title: 'Switch Verse Mode',
    description: 'Toggle between daily verse and verse by category.',
    position: 'below',
    bibleOnly: true, // skip for positivity users
  },
  // ...
];
```

### Pattern 4: Integration Point in AuthenticatedLayout
**What:** The TutorialProvider wraps inside SocketProvider/NotificationProvider, after the user is confirmed authenticated and onboarding is complete.
**When to use:** The tutorial must render AFTER the AppShell and daily feed are mounted.
**Example:**
```typescript
// In (app)/layout.tsx AuthenticatedLayout
return (
  <SocketProvider>
    <NotificationProvider>
      <FontLoader />
      <TutorialProvider>
        <AppShell>{children}</AppShell>
      </TutorialProvider>
    </NotificationProvider>
  </SocketProvider>
);
```

### Anti-Patterns to Avoid
- **Don't use refs to pass target elements:** The tutorial components are separate from the target components. Use `document.querySelector('[data-tutorial="..."]')` with `getBoundingClientRect()` instead.
- **Don't block feed loading for tutorial:** The tutorial waits for feed content to mount, not the other way around. Use a small delay (500ms) after initial render.
- **Don't add z-index higher than 50:** The existing Modal uses z-50. Tutorial overlays should use z-[60] to sit above modals but below nothing else critical.
- **Don't animate coach mark transitions with JS:** Use CSS transitions on the spotlight position/dimensions. The box-shadow technique makes this clean.
- **Don't persist tutorial state in localStorage:** Use DB column only. localStorage is device-specific; users may log in on multiple devices.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slideshow carousel | Custom slide transitions | Swiper with horizontal slidesPerView:1 | Already installed; handles touch, keyboard, pagination dots |
| Overlay rendering | Inline overlay div | createPortal to document.body | Escape z-index stacking contexts; established project pattern |
| Dark backdrop | Separate full-screen div | box-shadow: 0 0 0 9999px rgba(0,0,0,0.75) | Single element creates both cutout and overlay; no compositing issues |
| Step state machine | Manual useState chains | useReducer with step/phase state | Cleaner transitions; prevents impossible states |
| Element positioning | Manual offset calculations | getBoundingClientRect() | Handles scroll offset, safe areas, and responsive layouts |
| Body scroll lock | Custom overflow toggling | Copy pattern from Modal.tsx (document.body.style.overflow = 'hidden') | Existing tested pattern handles iOS Safari edge cases |

**Key insight:** The project already has 23 components using createPortal overlays. The tutorial is just another overlay -- the only new technique is the box-shadow spotlight cutout, which is pure CSS.

## Common Pitfalls

### Pitfall 1: Target Element Not Yet Mounted
**What goes wrong:** Coach marks try to find elements before the daily feed has rendered, getting null from querySelector.
**Why it happens:** The daily feed loads async content; DailyPostCarousel renders after API response.
**How to avoid:** Use a MutationObserver or polling loop (requestAnimationFrame) to wait for the target element to appear in the DOM. Set a maximum wait time (3s) and skip the step if element never appears.
**Warning signs:** `getBoundingClientRect()` returns all zeros or throws.

### Pitfall 2: iOS Safari Safe Area Interference
**What goes wrong:** Coach mark tooltips or spotlights are offset by the notch/home indicator inset.
**Why it happens:** The AppShell already accounts for safe areas with `env(safe-area-inset-*)`. Tutorial overlays via createPortal bypass this.
**How to avoid:** The spotlight uses `position: fixed` which is relative to the viewport. The `getBoundingClientRect()` values are already viewport-relative. No safe area adjustment needed for the spotlight itself. Tooltip positioning should respect bottom safe area to avoid being hidden behind the home indicator.
**Warning signs:** Tooltip cut off at bottom of screen on iPhone with home bar.

### Pitfall 3: Scroll Position Drift During Coach Marks
**What goes wrong:** User scrolls during coach marks, and the spotlight stays at the old element position.
**Why it happens:** `getBoundingClientRect()` values are viewport-relative and change on scroll.
**How to avoid:** Lock scrolling during coach marks (body overflow:hidden pattern from Modal.tsx). The daily feed page uses `#immersive-scroll` container for scrolling -- lock this container specifically.
**Warning signs:** Spotlight highlights empty space instead of the target element.

### Pitfall 4: Coach Marks on Transparent/Dark Background
**What goes wrong:** White tooltip text is invisible on the semi-transparent dark overlay; or the spotlight cutout shows the dark daily feed background, making the cutout indistinguishable from the overlay.
**Why it happens:** The daily feed is already dark (bg-[#0a0a0f]). A dark overlay cutout around a dark element creates no visual contrast.
**How to avoid:** Use a visible border or subtle glow (white ring or ring-primary) around the cutout to clearly delineate it. The tooltip card itself should use a solid white/surface background, not glass styling, for readability.
**Warning signs:** Users can't distinguish the highlighted element from the surrounding overlay.

### Pitfall 5: Swiper Touch Conflicts with Slideshow
**What goes wrong:** Swiping on the tutorial slideshow also triggers the underlying daily feed's vertical scroll snap.
**Why it happens:** Touch events propagate through the portal overlay to the daily feed scroll container.
**How to avoid:** The tutorial slideshow should call `e.stopPropagation()` on touch events, AND the body/immersive-scroll overflow should be locked during the slideshow phase (same as Modal.tsx pattern).
**Warning signs:** Swiping on the tutorial slideshow changes the daily feed underneath.

### Pitfall 6: Imported Users vs New Users
**What goes wrong:** The CONTEXT.md says imported users (31K) SHOULD see the tutorial, but the phase description's success criteria (#9) says they should NOT.
**Why it happens:** Contradictory specifications.
**How to avoid:** Follow the CONTEXT.md decisions (they are locked). The migration should set `has_seen_tutorial = false` for ALL existing users (both new signups and imported). The app is entirely new to all users.
**Warning signs:** N/A -- just set the correct default.

## Code Examples

Verified patterns from the existing codebase:

### Swiper Horizontal Slideshow (reusing DailyPostCarousel pattern)
```typescript
// Source: src/components/daily/DailyPostCarousel.tsx
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

<Swiper
  modules={[Pagination, Keyboard]}
  slidesPerView={1}
  pagination={{
    clickable: true,
    bulletClass: 'swiper-pagination-bullet !bg-white/50 !opacity-100',
    bulletActiveClass: '!bg-white !opacity-100 !scale-125',
  }}
  keyboard={{ enabled: true }}
  onSlideChange={(swiper) => setActiveSlide(swiper.activeIndex)}
  className="h-full w-full"
>
  <SwiperSlide>...</SwiperSlide>
</Swiper>
```

### createPortal Overlay (reusing Modal pattern)
```typescript
// Source: src/components/ui/Modal.tsx
import { createPortal } from 'react-dom';

// Lock body scroll on mount
useEffect(() => {
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = '';
  };
}, []);

return createPortal(
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
       role="dialog" aria-modal="true">
    <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
    <div className="relative z-10 ...">
      {children}
    </div>
  </div>,
  document.body
);
```

### User Model Field Addition Pattern
```typescript
// Source: src/lib/db/models/User.ts -- pattern for adding boolean field
// In UserAttributes interface:
has_seen_tutorial: boolean;

// In User.init():
has_seen_tutorial: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
  allowNull: false,
},
```

### API Route Pattern (withAuth HOF)
```typescript
// Source: src/app/api/auth/me/route.ts
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { User } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

export const PUT = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      await User.update(
        { has_seen_tutorial: true },
        { where: { id: context.user.id } }
      );
      return successResponse({ success: true });
    } catch (error) {
      return serverError(error, 'Failed to update tutorial status');
    }
  }
);
```

### AuthContext UserData Extension
```typescript
// Source: src/context/AuthContext.tsx
export interface UserData {
  // ... existing fields ...
  has_seen_tutorial: boolean;  // Add this
}
```

### Settings Page Button Pattern
```typescript
// Source: src/app/(app)/settings/page.tsx -- collapsible row pattern
<button
  type="button"
  onClick={() => handleReplayTutorial()}
  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
>
  <GraduationCap className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
  <span className="flex-1 text-sm font-medium text-text dark:text-text-dark">
    Replay Tutorial
  </span>
  <ChevronRight className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
</button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-joyride library | Custom implementation with CSS box-shadow | 2024-2025 | react-joyride not React 19 compatible; custom is simpler for small step counts |
| SVG mask overlays | CSS box-shadow: 0 0 0 9999px | Stable technique | Single CSS property creates cutout; no SVG complexity |
| Static tutorial images | Dynamically rendered app screenshots | Current trend | App UI shown in context; no asset maintenance burden |
| localStorage tutorial tracking | DB-column tracking | Standard for multi-device | Persists across devices and sessions |

**Deprecated/outdated:**
- **react-joyride (< v3):** Not React 19 compatible. The unstable v3 next branch exists but is unreliable. Do not use.
- **driver.js:** Popular alternative but adds unnecessary dependency for 4-step tour.
- **intro.js:** Heavy (30KB+), jQuery-era design, not React-native.

## Open Questions

Things that couldn't be fully resolved:

1. **Swipe gesture animation for coach mark step 1**
   - What we know: The first coach mark should show an animated "swipe up" hint on the daily card. CSS animation with a hand/chevron icon moving upward is standard.
   - What's unclear: Exact animation design -- whether to use a custom SVG hand icon or lucide-react ChevronUp with motion.
   - Recommendation: Use lucide-react ChevronUp with a CSS @keyframes animation bouncing upward. Keep it simple; no custom assets needed.

2. **Coach mark advancement model: auto-advance vs explicit "Next"**
   - What we know: CONTEXT.md gives discretion here. Both patterns are valid.
   - What's unclear: Which is better for this specific app's audience.
   - Recommendation: Use explicit "Next" / "Skip" buttons on each coach mark. Auto-advance on interaction is confusing when users don't know what interaction to perform. The swipe hint step can have a "Got it" button instead of requiring an actual swipe.

3. **Slideshow card content: dynamic screenshots vs illustrations**
   - What we know: CONTEXT.md says "dynamically rendered app screenshot (not static PNG images)" for each card.
   - What's unclear: Whether this means literally rendering a mini version of the app, or using stylized representations.
   - Recommendation: Use stylized mockup illustrations built with Tailwind/HTML -- small representations of the app UI using the same design tokens (colors, icons, etc.). Not actual live-rendered components, but visual mockups that match the app's look. This avoids the complexity of rendering real components in a miniature context.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: src/components/ui/Modal.tsx -- createPortal overlay pattern
- Codebase analysis: src/components/daily/DailyPostCarousel.tsx -- Swiper carousel pattern
- Codebase analysis: src/lib/db/models/User.ts -- User model boolean field pattern
- Codebase analysis: src/context/AuthContext.tsx -- UserData interface extension pattern
- Codebase analysis: src/app/(app)/layout.tsx -- Provider wrapping and auth guard patterns
- Codebase analysis: src/components/layout/BottomNav.tsx -- aria-label attributes on nav elements
- Codebase analysis: src/app/(app)/settings/page.tsx -- Settings page row/button pattern

### Secondary (MEDIUM confidence)
- [React Joyride GitHub](https://github.com/gilbarbara/react-joyride) -- React 19 incompatibility confirmed
- [Evaluating tour libraries for React (Sandro Roth)](https://sandroroth.com/blog/evaluating-tour-libraries/) -- Custom implementation recommended over libraries
- [CSS box-shadow MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/box-shadow) -- box-shadow spread technique for overlays
- [CSS pointer-events MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/pointer-events) -- pointer-events:none for non-blocking overlays

### Tertiary (LOW confidence)
- [5 Best React Product Tour Libraries (Whatfix)](https://whatfix.com/blog/react-onboarding-tour/) -- General landscape overview
- [Top 8 React Product Tour Libraries (Chameleon)](https://www.chameleon.io/blog/react-product-tour) -- Market overview

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools already in the project; no new dependencies
- Architecture: HIGH -- Follows established project patterns (createPortal, contexts, Swiper)
- Pitfalls: HIGH -- Derived from analysis of actual codebase layout (immersive scroll, safe areas, dark theme)
- Coach mark technique: HIGH -- CSS box-shadow spotlight is a well-established, browser-supported technique

**Research date:** 2026-02-20
**Valid until:** Indefinite -- all techniques are stable; no rapidly changing dependencies
