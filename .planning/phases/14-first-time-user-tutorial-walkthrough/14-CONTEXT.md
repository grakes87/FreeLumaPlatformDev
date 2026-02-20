# Phase 14: First-Time User Tutorial & Walkthrough - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a first-time user tutorial that introduces new and imported users to the FreeLuma app. Consists of a slideshow introduction followed by coach marks on the real feed. Triggered once per user (DB-tracked), replayable from Settings. Does not include ongoing tooltips, contextual help systems, or documentation pages.

</domain>

<decisions>
## Implementation Decisions

### Tutorial format
- Two-phase flow: slideshow (3-4 cards) first, then coach marks on the real daily feed
- Slideshow introduces concepts; coach marks point at actual UI elements
- Skip button always visible on every step (slideshow and coach marks)
- Completing or skipping either phase advances to the next / dismisses tutorial

### Slideshow content (4 cards)
- **Card 1: Daily feed + swipe** — Explains the vertical daily content feed, swipe up to see next day
- **Card 2: Bible vs Positivity modes** — Explains the two content modes and how to switch
- **Card 3: Social features** — Reactions, comments, sharing, prayer wall (bible mode only)
- **Card 4: Bottom navigation** — Home, Explore, Create Post, Chat, Profile tabs
- Each card uses a dynamically rendered app screenshot (not static PNG images)
- Warm & encouraging tone throughout

### Mode-specific content
- Bible users see: verse mode toggle explanation, prayer wall mention
- Positivity users: no verse toggle or prayer wall references
- Determine user's mode from their current route or preference at tutorial time

### Coach marks (4 elements)
- **Swipe up gesture** — Animated hint on the daily card to swipe up
- **Verse mode toggle** — Highlight the bible/chapter toggle (bible mode only)
- **Bottom nav tabs** — Spotlight the 5 navigation tabs with brief labels
- **Reactions & comments** — Highlight the interaction area on the daily card

### Trigger & timing
- DB column `has_seen_tutorial` (boolean, default false) on users table
- All imported users (31K) see tutorial on first login (since app is entirely new)
- New signups also see tutorial after first login
- Tutorial appears AFTER the daily feed has fully loaded (so coach marks target real elements)
- Migration adds the column; import script sets has_seen_tutorial=false for all imported users

### Replay
- "Replay Tutorial" option in the Settings page
- Resets has_seen_tutorial to false, then navigates to the daily feed to re-trigger

### Visual style
- **Slideshow**: Centered modal card over semi-transparent dimmed backdrop
- **Coach marks**: Dark overlay with spotlight cutout around target element
- **Transitions**: Horizontal swipe/slide animation between slideshow cards (carousel)
- **Progress**: Dot indicators at bottom of slideshow (active dot highlighted)

### Claude's Discretion
- Exact card dimensions and responsive breakpoints
- Animation durations and easing curves
- Coach mark tooltip positioning logic (above/below/side of element)
- Spotlight cutout shape (rounded rect vs circle)
- Exact copy/wording on each card (within warm & encouraging tone)
- Whether coach marks advance automatically on interaction or require explicit "Next"
- Component architecture (single component vs split slideshow/coach-mark components)

</decisions>

<specifics>
## Specific Ideas

- Slideshow screenshots should be dynamically rendered mini-previews of the actual app UI, not static image files — keeps them always up-to-date as the app evolves
- Coach marks should feel natural and non-intrusive — user can skip at any time
- The tutorial should work on both mobile and desktop viewports

</specifics>

<deferred>
## Deferred Ideas

- Contextual tooltips for new features added later (separate from onboarding tutorial)
- Video walkthrough / animated demo
- A/B testing different tutorial flows
- Analytics on tutorial completion rates

</deferred>

---

*Phase: 14-first-time-user-tutorial-walkthrough*
*Context gathered: 2026-02-20*
