# Phase 17: Both Mode - URL-driven daily content without mode switching - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a third mode option "Both" to the existing Bible/Positivity mode system. Users who select Both can access both Bible and Positivity daily content via a pill toggle on the daily content first slide. The entry URL determines the initial mode (/positivity loads Positivity, root loads Bible). The entire app UX switches to mirror the selected mode — same behavior as changing mode in Settings, but without updating the database. Bible-only and Positivity-only users are unaffected.

</domain>

<decisions>
## Implementation Decisions

### Default & URL Behavior
- Root URL (freeluma.app) defaults to Bible for Both users
- `/positivity` URL loads Positivity content for Both users
- External links (notification deep links, shared links) respect the URL path
- URL in address bar stays static — does not update when toggling modes
- Date deep links (`/daily/[date]`) use the current session mode
- Session mode stored in localStorage — persists across page refreshes, defaults to Bible on first visit (no localStorage value)

### In-App Mode Toggle
- Pill toggle (Bible / Positivity) on the first slide of each day's carousel — only visible to Both-mode users
- Bible-only and Positivity-only users do not see the toggle
- Tapping the toggle reloads the entire daily feed in the new mode
- Scroll position resets to top (today) on mode switch
- Toggle appears on every day's first slide in the vertical scroll feed

### Full UX Switching
- Toggling modes produces the same effect as changing mode in Settings
- BottomNav tabs update — Prayer Wall appears in Bible view, hidden in Positivity view
- Verse-by-Category toggle only appears in Bible view
- All mode-dependent features switch based on the active toggle selection
- Non-daily pages (Feed, Chat, Watch, Profile) behave the same as they would for a Bible-only or Positivity-only user in that mode

### Notifications (Email, Push, SMS)
- Both users receive two separate daily reminder notifications — one for Bible, one for Positivity
- Both notifications sent at the same configured reminder time
- Each notification deep-links to its respective mode's content
- Email: two separate emails using existing single-mode template (sent twice)
- Push: two separate push notifications
- SMS: two separate SMS messages

### Mode Selection
- "Both" available in Settings only — third option alongside Bible and Positivity
- Not available during signup — new users pick Bible or Positivity
- Brief mention during signup that Both mode is available in Settings
- No onboarding prompt when activating Both — just activates immediately
- Both mode always defaults to Bible on first load (localStorage empty)

### Database Changes
- Additive migration: add 'both' to User.mode ENUM('bible','positivity','both')
- No existing users changed — opt-in via Settings only
- Active view mode tracked in client-side localStorage only — no new DB column

### Activation Codes
- No changes needed — activation codes are mode-agnostic, work for all modes
- No 'both' mode_hint needed on codes

### Edge Cases
- Cross-mode deep links: if Both user in Positivity taps a shared Bible daily post link, session switches to Bible and toggle updates
- Missing content for a day in one mode: skip that day in the feed (no placeholder)
- No content at all for a mode: auto-switch back to Bible with a toast message
- Single-mode users (Bible-only or Positivity-only) ignore URL paths for other modes — always see their own mode's content

### Claude's Discretion
- Pill toggle visual design (colors, sizing, positioning on the first slide)
- Gradient/overlay adjustments to accommodate the toggle over video background
- Toast message wording for auto-switch-back on empty content
- localStorage key naming and any related state management patterns
- Brief mention copy during signup about Both mode availability
- Notification content differentiation (how Bible vs Positivity reminder text differs)

</decisions>

<specifics>
## Specific Ideas

- The mode toggle acts as a quick-switch — same UX effect as changing mode in Settings, but without persisting to the database (account stays "both")
- Both mode is a power-user feature discovered through Settings, not pushed during onboarding
- Two notifications per channel keeps it simple — reuse existing templates, just send twice

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DailyPostCarousel.tsx`: Swiper-based carousel — pill toggle inserts on first slide, mode change triggers refetch
- `DailyPostSlide.tsx`: First slide with video background — toggle overlays on this component
- `useDailyContent.ts` / `useDailyFeed.ts`: Already accepts mode parameter — toggle changes the mode passed to these hooks
- `BottomNav.tsx`: Already filters tabs with `bibleOnly` flag — needs to read active view mode instead of just `user.mode`
- Settings mode selector: Existing Bible/Positivity radio UI — add third "Both" option

### Established Patterns
- `User.mode` enum column with Sequelize migration pattern for adding enum values
- `effectiveMode = user?.mode || 'bible'` pattern used across the app — needs to become active view mode for Both users
- `bibleOnly` tab filtering in BottomNav — extend to use active view mode
- localStorage used elsewhere in the app (theme preferences) — consistent pattern
- Conditional slide rendering in carousel (LumaShortSlide skip pattern)

### Integration Points
- `User` model: Add 'both' to mode enum via Sequelize migration
- `DailyPostCarousel.tsx`: Add pill toggle component, wire to active view mode state
- `BottomNav.tsx`: Read active view mode (from context/localStorage) instead of just `user.mode`
- Settings page mode selector: Add "Both" as third option
- Notification scheduler: For Both users, send two reminders per channel (Bible + Positivity)
- Email/push/SMS templates: Reuse existing single-mode templates, parameterized by mode
- Auth context or new ViewModeContext: Provide active view mode to the component tree
- SignupForm.tsx: Add brief mention of Both mode availability

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-both-mode-url-driven-daily-content-without-mode-switching*
*Context gathered: 2026-03-12*
