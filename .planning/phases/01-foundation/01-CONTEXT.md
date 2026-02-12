# Phase 1: Foundation - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure authentication, database infrastructure, and daily content delivery established. Users can sign up (invite-only via activation codes), log in, complete guided onboarding, and receive their daily inspirational post (Bible verse or positivity quote) in a 3-slide immersive experience. Includes mobile-first responsive layout with bottom tab navigation, dark mode support, basic profile card with settings, and push notification infrastructure.

Social interactions on the daily post (reactions, comments, tagging) are Phase 2. Full profile page is a separate phase. Age-gated feature restrictions are a separate phase.

</domain>

<decisions>
## Implementation Decisions

### Daily content experience
- **3-slide swipeable daily post:**
  1. **Slide 1: The Post** — Full-screen immersive view with MP4 video background (autoplay, silent, looping). Bible verse (faith mode) or inspirational quote (positivity mode) overlaid on video. Translation switcher on-screen (default from user settings, quick-switch available). Share as generated image card with verse + background + branding. Arrow navigation to go back to previous days (never forward past current date).
  2. **Slide 2: Full Chapter Audio** — Audio player styled like iPhone Music app. SRT subtitles with karaoke-style synced highlighting (words highlight as audio plays). Full chapter audio for the daily content.
  3. **Slide 3: LumaShort Video** — Recorded video discussing/explaining the daily verse or quote. User-initiated playback (not autoplay).
- Comments and reactions persist across all three slides (same thread regardless of which slide is viewed) — but the reaction/comment system itself is Phase 2
- Each daily post has a specific matched MP4 video background (not rotating/random)
- Daily content changes at user's local midnight (timezone-aware)
- Both faith mode and positivity mode have all 3 slides (different content per mode)

### Daily content source & management
- **No external API dependency** — scrapping kindredsplendorapi.com. All daily content (Bible verses AND positivity quotes) pulled from own SQL database
- Bible translations primarily stored in database. Fallback: if a translation is missing, fetch from bible.api and store it for that day
- Bible translations cached for performance (along with daily post content and MP4 backgrounds via Cloudflare)
- Content management: bulk import for initial content load + admin panel for ongoing daily content scheduling
- Admin schedules daily content with text (verse/quote) AND matched video background

### Bible translations
- Supported translations: KJV, NIV, NRSV, NAB (expandable)
- Default translation set in user settings, auto-loads on daily post
- Quick-switch translation selector also available on the daily post screen

### Platform mode (faith vs positivity)
- Two modes: **Bible/faith** and **Positivity**
- User chooses mode during signup onboarding, can change anytime in settings
- Mode determines: daily content type (verses vs quotes), tab visibility (Luma Animations hidden in positivity), and content throughout the app
- Single domain with path-based entry points: `/bible` and `/positivity` for NFC bracelets and shareable links
- Unauthenticated users land on the experience matching their entry path
- Activation code can be embedded in URL: `?activation_code=XXXXXXXXXXXX`
- Once authenticated, experience is purely driven by profile setting (path no longer matters)
- URL `?mode=bible` or `?mode=positivity` pre-selects mode during signup

### Auth flow & onboarding
- **Activation code required** — invite-only platform
  - One-time use activation codes stored in database
  - Can be passed via URL query param or entered manually at start of signup
  - Validated against database before registration proceeds
  - Admin generates codes in bulk via admin panel
  - Codes distributed externally (e.g., NFC bracelets with encoded URLs)
- **Sign-up methods:** Email/password + Google Sign-In + Apple Sign-In (no Facebook)
- **Guided onboarding steps after credentials:**
  1. Mode selection (faith/positivity) — pre-selected if entry URL had mode hint
  2. Profile setup (display name, @username, avatar, bio)
  3. Interest/category selection
  4. Follow suggestions (official platform accounts)
- **Email verification:** Not required for access. Full app access immediately, reminder banner to verify
- **Terms + age verification:** Terms of service checkbox + date of birth field during signup (age-gated restrictions deferred to separate phase, but DOB captured now)
- **Login screen:** Clean and branded — app logo at top, login form centered, social login buttons below
- **Password reset:** Email link (click to reset on web page)
- **Session:** Stay logged in indefinitely until explicit logout
- **Username:** Unique @username picked during onboarding for tagging and discovery

### App shell & navigation
- **Bottom tab navigation (icons only, no labels):**
  - Bible mode (6 tabs): Daily Post, Prayer Wall, Feed, Bible Studies (workshops), Luma Animations, Profile
  - Positivity mode (5 tabs): Daily Post, Prayer Wall, Feed, Bible Studies, Profile (no Luma Animations)
- **Top bar:** App logo on left, notification bell icon on right
- **Daily post tab:** Semi-transparent nav overlays — video background shows through top and bottom bars
- **Dark mode:** Follow system default, toggle override in settings (light/dark/system)
- **Visual tone:** Modern and clean — crisp, minimal design with subtle accents
- **Responsive:** Mobile-first with responsive desktop layout from the start
- **Standard web app** — not a PWA (no install prompts or service worker)
- **Luma Animations tab:** Animated Bible stories (visible only in Bible/faith mode)

### Profile & avatar (Phase 1 scope)
- Profile tab shows: basic profile card (avatar, name, @username, bio) at top + settings options below
- Full profile page deferred to separate phase
- **Avatar upload:** Photo upload with crop/zoom tool to frame photo
- **Default avatar:** Initials-based with random color assigned at signup (permanent)
- **Bio:** 150-character limit (Instagram style)
- **No badges or mode indicators** on profile card — clean presentation
- **Settings section includes:** Account management, appearance (dark mode), language preference, notification settings, mode toggle (faith/positivity), log out

### Claude's Discretion
- Color palette and accent colors (modern, clean, fitting for faith/positivity)
- Desktop navigation layout (sidebar vs bottom bar on wider screens)
- Loading states, error states, and skeleton designs
- Exact spacing, typography, and icon choices
- Push notification infrastructure approach (given no PWA/service worker)
- Audio player exact UI details beyond "iPhone Music app style"
- Crop tool implementation details

</decisions>

<specifics>
## Specific Ideas

- Daily post should feel truly immersive — full-screen video backgrounds with the verse/quote overlaid, like a daily meditation moment
- Audio player modeled after iPhone's native Music app with SRT karaoke-style synced highlighting
- NFC bracelets are a key distribution channel — URL-based activation codes and mode hints must work seamlessly from bracelet tap to signup
- Share button generates an image card (not just text) with verse + background + app branding
- Bible verse translations fetched on-demand from bible.api if missing locally, then cached
- The 3-slide swipe interaction is central to the daily experience — all three slides (post, audio, video) are equally important

</specifics>

<deferred>
## Deferred Ideas

- **Full profile page** — User described it as "quite robust" and warranting its own phase. Separate from Phase 1's basic profile card + settings.
- **Age-gated feature restrictions** — Platform changes for users under 18 (restricted tabs/functions). DOB captured in Phase 1 signup, restrictions implemented in dedicated phase.
- **Social interactions on daily post** — Facebook-style emoji reactions (predefined set), full comment threading, reply to comments/replies, user tagging in comments, like comments/replies. All scoped to Phase 2: Core Social.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-11*
