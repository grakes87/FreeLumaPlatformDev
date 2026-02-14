# Phase 4: Enhanced Content - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Video library with progress tracking, account lifecycle management (deactivation, deletion, email/password changes, connected accounts, activity streaks), and admin moderation system (report queue, user management, bans, audit log). Many settings features (appearance, language, notifications, privacy, blocked users, messaging access) were already built in Phases 1-3 and do NOT need re-implementation.

**Already built (skip):** Settings page, appearance toggle, language preference, notification preferences by category, daily reminder with timezone, privacy settings, blocked users list, messaging access, quiet hours, settings persistence.

**Removed from scope:** Personal Notes (deferred to future version).

</domain>

<decisions>
## Implementation Decisions

### Video Library — Layout & Navigation
- Netflix-style layout: horizontal scrollable rows per category
- Auto-play hero banner at top (like Netflix home)
- "Continue Watching" row prominent at top of library
- Admin-defined categories (managed from admin dashboard)
- Videos ordered by most popular (view count) within each category
- Bottom nav tab renamed from "Animations" to "Watch"
- No search — browse-only via category rows and hero
- No video bookmarks

### Video Library — Content & Upload
- Admin-uploaded recordings stored in Backblaze B2
- Single video file served as-is (no transcoding/multi-quality)
- Streaming only (no offline downloads)
- Single video upload form: title, description, category, thumbnail auto-generated from video frame
- Admin-generated captions (auto-generated, not manual SRT upload)
- View count + duration shown on video thumbnails

### Video Library — Playback & Player
- Tap thumbnail → detail page first (title, description, play button, reaction bar)
- No "Related Videos" section on detail page — keep it simple
- Full-screen immersive player
- Basic player controls (play/pause, seek, volume) + captions toggle
- No playback speed controls
- Resume playback with progress tracking (saved per user per video)

### Video Library — Social & Notifications
- Reactions only on videos (same 6 types as posts) — no comments
- Share to chat (send video to DM conversation)
- In-app notification when new videos are added to library

### Account Lifecycle — Deletion & Deactivation
- Two separate options: Deactivate (temporary, reversible anytime) and Delete (permanent after 30-day grace period)
- Deactivate: confirm dialog only (no reason asked), instant restore on re-login
- Delete: 30-day soft delete grace period, user can reactivate by logging in during grace period
- Deactivated profiles show "Account deactivated" message to others (grayed out in follower lists)
- Content anonymized on permanent deletion (posts stay visible, author shown as "Deleted User")
- Content hidden while user is banned (restored when ban lifts)
- Delete option buried deeper in UI (Settings > Account > Danger Zone), Deactivate more accessible
- No data export feature

### Account Lifecycle — Email & Password
- Email change: verify NEW email first before switch takes effect
- User stays logged in with old email during verification
- Password change: requires current password confirmation
- Security alert email sent on password change ("If this wasn't you, contact support")

### Account Lifecycle — Connected Accounts
- Show connected OAuth providers (Google/Apple) in settings
- Users can unlink OAuth provider only if they have a password set (prevents lockout)
- Users can link additional OAuth providers to existing account

### Account Lifecycle — Stats & Streaks
- Account stats page with card-based layout (Account Info card, Activity card, Streak card)
- Basic stats: join date, total posts, followers/following count
- Activity streaks tracked — qualifying activities per day:
  - Viewing the daily post
  - Listening to the full audio chapter
  - Watching majority of the LumaShort video
  - Reacting, commenting, or posting to prayer wall or social feed
  - Any one qualifying activity counts as "active" for the day
- Streak shown on stats page only (not on profile or daily post screen)
- Content mode displayed as info on stats page (switching stays in existing settings)

### Admin Moderation — Report Queue
- Reports grouped by content (one queue entry per reported item, all reporters/reasons shown together)
- Admin actions: remove content, send custom warning message, temporary ban, permanent ban
- Fixed ban durations: 24 hours, 7 days, 30 days, permanent
- Banned users see suspension message with expiry date when trying to use app
- Author notified with reason when content removed ("Your post was removed for [reason]")
- Admin action is final (no in-app appeal system)

### Admin Moderation — User Management
- Admin + Moderator roles: Admin has full access, Moderator can review reports and warn users but cannot ban or change settings
- Admin user browser with search, filtering, and ability to edit user details (email, username, mode, verified status)
- Full access to any user's content including deleted and private posts
- Moderation stats dashboard: report counts, action breakdown, repeat offenders list

### Admin Moderation — Audit Trail
- Full searchable moderation log: admin name, action taken, reason, timestamp
- All moderation actions logged for accountability
- Custom warning messages (admin types message per situation, no templates)

### Claude's Discretion
- Video thumbnail auto-generation implementation approach
- Caption auto-generation technology/service choice
- Streak calculation and storage architecture
- Moderation queue filtering/sorting UX details
- Ban enforcement middleware approach
- Account stats card visual design
- Hero banner auto-play behavior (muted, loop, etc.)

</decisions>

<specifics>
## Specific Ideas

- Netflix-style video library: hero banner at top with auto-play, horizontal category rows below, "Continue Watching" most prominent
- Video player: basic controls with captions, NOT speed controls — keep it simple
- Streaks: multi-activity tracking (daily post, audio, video, social interactions) — any one counts
- Ban system with content hiding: banned user's content hidden during ban, restored when lifted
- Deactivated profiles visible as "Account deactivated" — not hidden entirely
- Admin captions: auto-generated (not manual SRT upload by admin)

</specifics>

<deferred>
## Deferred Ideas

- **Personal Notes** — Removed from Phase 4 entirely. User does not want notes in this version. Defer to future version/phase.
- **Video bookmarks** — User said not needed for this phase.
- **Video search** — Browse-only for now. Search could be added later.
- **Multiple video quality levels** — Single file for now. Transcoding deferred.
- **Video comments** — Reactions only for now. Comments on videos deferred.
- **Data export** — No data export on account deletion for now.
- **In-app ban appeals** — Admin action is final. External support contact only.

</deferred>

---

*Phase: 04-enhanced-content*
*Context gathered: 2026-02-13*
