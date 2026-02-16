# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Daily inspirational content delivery and faith-based community connection — users come back every day for their daily post and stay to engage with their community.

**Current focus:** Phase 9 - Platform Refinements & Admin Tools (In progress)

## Current Position

Phase: 9 of 9 (Platform Refinements & Admin Tools)
Plan: 1 of 6 complete (01 done)
Status: In progress
Last activity: 2026-02-16 — Completed 09-01-PLAN.md

Progress: [████████████████████████████████████████████████████████████████████████░░░░] 74/79 plans (94%)

**Next Plans:** 09-04, 09-05, 09-06

## Performance Metrics

**Velocity:**
- Total plans completed: 74
- Average duration: 4 min
- Total execution time: 329 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 12/12 | 63 min | 5 min |
| 02-core-social | 14/14 | 73 min | 5 min |
| 03-real-time | 13/13 | 49 min | 4 min |
| 04-enhanced-content | 14/14 | 58 min | 4 min |
| 05-workshops | 14/14 | 49 min | 4 min |
| 06-bug-fixes | 5/6 | 13 min | 3 min |
| 08-database-migration-mapping | 2/3 | 14 min | 7 min |
| 09-platform-refinements | 1/6 | 4 min | 4 min |

**Recent Trend:**
- Last 5 plans: 06-05 (2 min), 06-01 (5 min), 08-01 (7 min), 08-02 (7 min), 09-01 (4 min)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **ESM + CJS coexistence:** Package type set to "module" for ESM server.js; Sequelize CLI config uses .cjs extension
- **React Compiler:** Enabled at top-level `reactCompiler` (not experimental) in Next.js 16 with babel-plugin-react-compiler
- **MySQL connection:** Via TCP 127.0.0.1 (not socket) for XAMPP MariaDB compatibility
- **Old Code exclusion:** Added to tsconfig.json exclude and .gitignore
- **Migration/seeder .cjs extension:** All Sequelize CLI migration and seeder files use .cjs extension for ESM package compatibility
- **FK cascade strategy:** user_categories, user_settings, push_subscriptions CASCADE on user delete; activation_codes SET NULL on user delete
- **Admin dev password:** "AdminDev123!" hashed with bcryptjs (12 rounds) for seeded admin user
- **cn() utility pattern:** All UI components use `cn()` from `@/lib/utils/cn` for Tailwind class merging (clsx + tailwind-merge)
- **Dark mode approach:** Components use `dark:` variant classes matching Tailwind v4 `@custom-variant dark` with `data-theme="dark"` attribute
- **forwardRef for form inputs:** Input component uses React.forwardRef for react-hook-form `register()` compatibility
- **Toast via React context:** ToastProvider wraps app, `useToast()` hook provides `toast.success/error/info/warning` methods
- **Portal rendering:** Modal and Toast use `createPortal(el, document.body)` to escape stacking contexts
- **ToastProvider placement:** Added to root layout in 01-04 (available app-wide)
- **Auth context pattern:** AuthProvider wraps (app) and onboarding layouts; useAuth() hook for all authenticated components
- **Route group separation:** (public) for unauthenticated, (app) for authenticated with AppShell, onboarding for post-signup flow
- **BottomNav mode filtering:** Prayer wall tab hidden for positivity mode users; Watch tab visible for all modes; 6 tabs (bible) / 5 tabs (positivity)
- **Transparent nav overlay:** TopBar and BottomNav accept transparent prop for daily post video backgrounds
- **Lazy JWT secret loading:** getSecret() function reads JWT_SECRET at call time, not module init, preventing zero-length key errors
- **SameSite=Lax auth cookie:** Lax (not Strict) to allow cookie on navigations from external NFC bracelet URLs
- **withAuth HOF pattern:** API routes wrapped with withAuth(handler) that injects user from JWT cookie into context parameter
- **Zod v4 safeParse:** Using safeParse + first error message extraction for user-friendly validation responses
- **GoogleOAuthProvider scoping:** Wraps only GoogleButton component, not entire layout, to avoid unnecessary SDK loading
- **OAuth activation code enforcement:** New OAuth signups require activation code; existing users (found by social ID or email) auto-link
- **signupCredentialsSchema:** Separate client-side Zod schema for signup form (excludes activation_code field)
- **registerSchema extension:** date_of_birth (YYYY-MM-DD) and terms_accepted (must be true) added for signup compliance
- **B2 null client pattern:** b2Client is null when env vars missing; isB2Configured boolean guards all storage operations; API returns 503
- **Presigned URL upload pattern:** GET presigned URL -> PUT to B2 -> POST confirm to API; key format avatars/{userId}/{timestamp}-{random}.{ext}
- **Client-side avatar crop:** Canvas API produces 256x256 JPEG at 0.9 quality; sharp not used for Phase 1 avatars
- **withAdmin middleware:** Wraps withAuth + lazy-imports User model for is_admin DB check; returns 403 for non-admins
- **Activation code alphabet:** Excludes O/0/I/l to avoid visual confusion in NFC URLs and printed materials
- **Entry page full-screen overlay:** /bible and /positivity use fixed inset-0 z-50 to break out of public layout container
- **Timezone override via query param:** Daily content API accepts ?timezone= for client-detected timezone, falls back to user profile
- **API.Bible fallback pattern:** DB-first translation lookup, bible.api fallback for missing translations, auto-cache to DB with source='api'
- **Positivity translation guard:** Translation switching returns 400 for positivity mode content (quotes are language-based, not translation-based)
- **Debounced username check:** 400ms debounce with visual spinner/check/X indicator; skips API if unchanged from current username
- **Category bulk replace:** DELETE all + bulkCreate new UserCategory rows on each save (correct for onboarding)
- **Follow suggestions Phase 1:** Placeholder accounts shown; actual follow persistence deferred to Phase 2
- **Public categories endpoint:** No auth on GET /api/categories for onboarding access
- **Username check rate limit:** 10 requests/min/IP to prevent enumeration
- **Swiper pagination above nav:** Pagination bullets at 72px from bottom to sit above semi-transparent bottom nav on daily post
- **Share card inline styles:** Off-screen share card uses inline styles (not Tailwind) for html-to-image rendering consistency
- **Daily route full-screen layout:** AppShell removes pt-14/pb-16 padding for / and /daily/* routes, carousel extends behind transparent nav
- **LumaShort controls timing:** Native video controls shown only after user initiates playback, keeping poster view clean
- **Signed JWT email tokens:** Purpose-scoped JWTs (password_reset 1h, email_verification 24h) instead of DB-stored tokens
- **Console email fallback:** Nodemailer logs emails to console when SMTP_HOST not configured (dev mode)
- **Merged settings endpoint:** Single GET/PUT /api/settings handles both UserSetting and User table fields
- **Debounced auto-save settings:** 500ms debounce on settings changes with optimistic UI update and toast feedback
- **Mode switch confirmation:** Confirmation dialog before mode change to prevent accidental content type switches
- **Post paranoid soft delete:** Posts use Sequelize paranoid mode (deleted_at) for content moderation recovery
- **Polymorphic bookmarks:** Bookmark has nullable post_id and daily_content_id with separate unique indexes
- **PrayerRequest as Post extension:** prayer_requests table 1-to-1 with posts (post_type='prayer_request')
- **PlatformSetting KV store:** Static get()/set() helpers on PlatformSetting model for easy global config access
- **Repost as quote post:** reposts table links original post_id to a new quote_post_id (itself a Post row)
- **Platform settings seeded in migration:** 7 defaults (feed_style, mode_isolation_social/prayer, registration_mode, maintenance_mode, profanity_filter, ai_moderation)
- **Profanity asterisk strategy:** obscenity library with asteriskCensorStrategy for post content flagging and censoring
- **Anonymous post masking:** Anonymous posts return id:0, username:'anonymous' for non-authors at API level
- **Post body max 5000 chars:** Generous limit for prayer requests/testimonies, validated via Zod
- **Post media key prefix 'posts/':** Separates post media from avatars and daily-content in B2 bucket
- **Raw SQL for follow suggestions:** Three-strategy UNION ALL (popular, interest-based, new users) more performant than multiple Sequelize queries
- **Bidirectional block check:** Both blocker and blocked excluded from follow/search results in all directions
- **3-second unfollow confirm timeout:** Prevents accidental unfollows without blocking the UI permanently
- **Post comment cursor pagination:** Cursor-based (id > cursor) instead of offset for post comments; handles concurrent inserts correctly
- **2-level thread flattening:** Reply-to-reply flattens to root comment server-side; prevents deep mobile nesting
- **POST_COMMENT_MAX_LENGTH = 2000:** Separate from daily COMMENT_MAX_LENGTH (1000); post discussions allow longer messages
- **Top 2 reply previews:** GET root comments includes top 2 replies inline to reduce round trips
- **Bible-mode prayer restriction:** Prayer wall returns 403 for positivity-mode users; all prayer posts created with mode='bible'
- **Pray toggle transaction:** sequelize.transaction wraps PrayerSupport create/destroy + pray_count increment/decrement for atomicity
- **Supporters author-only:** Only prayer request author can view list of people who prayed (privacy)
- **Bookmark toggle action response:** Returns { action: 'added'/'removed' } for client state management
- **Quote repost dual-record:** Creates new Post (text type) + Repost record linking original to quote
- **Block single-query unfollow:** Follow.destroy with Op.or removes both directions in one query
- **Report duplicate 409:** Same reporter + content_type + content_id returns 409 "Already reported"
- **One draft per type per user:** Upsert pattern (findOrCreate by user_id + draft_type) simplifies draft resume
- **Platform settings read-any write-admin:** GET open to any auth user for client rendering; PUT restricted to withAdmin
- **Debounced draft save 2s:** 2000ms debounce with fire-and-forget flush on unmount prevents data loss
- **FYP application-level scoring:** 200-post candidate pool scored in JS (0.4 recency + 0.3 engagement + 0.2 relationship + 0.1 category) for flexibility over complex SQL
- **FYP compound cursor:** score+id cursor for FYP pagination (posts sorted by score, not chronologically)
- **Feed batch lookup:** User reactions/bookmarks fetched separately after post IDs known, not JOINed into main query
- **Default FYP tab:** useFeed defaults to 'fyp' tab per product context
- **Prayer card always liquid glass:** Prayer cards use bg-white/10 backdrop-blur-2xl regardless of admin feed style toggle (always card-based per CONTEXT)
- **My Prayers dropdown sub-tabs:** My Prayers tab uses dropdown for sub-tabs (My Requests / Prayers I've Joined) instead of nested tab bar
- **Prayer wall FAB:** Floating action button at bottom-right opens prayer composer in addition to center '+' nav CreatePicker
- **Split BottomNav tabs:** LEFT_TABS (Daily, Prayer, Feed) and RIGHT_TABS (Studies, Watch, Profile) with center '+' button between
- **Prayer wall tab bibleOnly:** Hidden for positivity mode users (prayer wall is bible-mode only)
- **CreatePicker route-based default:** Auto-selects Prayer Request on /prayer-wall, Feed Post elsewhere
- **Create via query param:** '+' button navigates to /feed?compose=post or /prayer-wall?compose=prayer_request
- **PostComposer createPortal:** Full-screen composer renders via createPortal for z-index isolation
- **Inline comments on post detail:** Post detail uses inline thread (not bottom sheet) for deep-link UX
- **User posts batch enrichment:** /api/users/me/posts uses separate queries for reactions/comments/bookmarks after post IDs known
- **PostCard dual variant delegation:** PostCard wrapper delegates to PostCardInstagram or PostCardTikTok based on feedStyle from usePlatformSettings
- **Deterministic gradient selection:** TextPostGradient uses postId % 10 for consistent gradient per post across re-renders
- **TikTok mode hides search:** Search bar omitted in TikTok feed mode for immersive full-screen experience
- **MediaCarousel IntersectionObserver:** Videos autoplay muted when 50% visible, pause when scrolled away
- **Chat denormalized last_message:** Conversations store last_message_id/last_message_at for fast inbox sorting (no FK to avoid circular dep)
- **MessageStatus no timestamps:** Per-recipient delivered/read tracking uses only status_at, no created_at/updated_at
- **ConversationParticipant soft delete:** deleted_at enables per-user conversation deletion without removing group membership
- **MessageRequest unique pair:** (requester_id, recipient_id) constraint prevents duplicate messaging requests
- **Message reaction types match posts:** Same 6 types (like/love/haha/wow/sad/pray) for UI consistency
- **Notification group_key pattern:** Encodes type:entity_type:entity_id (e.g. "reaction:post:123") for collapsible notifications
- **EmailLog tracking pixel:** UUID tracking_id for email open tracking via pixel; status enum queued/sent/bounced/opened
- **Messaging access default mutual:** messaging_access defaults to 'mutual' -- only mutual followers can initiate DMs
- **Per-category email toggles:** Separate boolean columns for DM, follow, prayer, and daily reminder email notifications
- **Reminder timezone column:** IANA timezone string in user_settings for timezone-aware daily reminder scheduling
- **Server.js inline Socket.IO init:** server.js creates SocketServer directly and stores on globalThis.__io (can't import TS from .js)
- **Lazy namespace setup:** getIO() lazily sets up /chat and /notifications namespaces with idempotent guard for HMR safety
- **Dual globalThis guard:** Module-level + globalThis.__ioNamespacesReady flags handle both production and dev HMR namespace readiness
- **Cookie-based WebSocket auth:** Socket.IO auth middleware reads auth_token from HTTP cookie header, same as REST API auth
- **Centralized createNotification():** Single entry point writes DB + pushes Socket.IO; suppresses self-notifications and blocked users
- **Raw SQL grouped notifications:** LEFT JOIN subquery with ROW_NUMBER for grouped feed; Sequelize ORM insufficient for this pattern
- **Notification count_only mode:** GET /api/notifications?count_only=true for lightweight badge updates without full payload
- **Room-per-conversation targeting:** Chat events target conv:{id} rooms only, never broadcast to namespace
- **Auto-join conversation rooms on connect:** Users join all active conversation rooms on socket connection for immediate delivery
- **Volatile typing indicators:** typing:start/stop use socket.to().volatile.emit() for droppable delivery
- **Batch read receipt pattern:** Single conversation:read event updates ConversationParticipant.last_read_at + batch MessageStatus for 1:1
- **MessageRequest creates hidden conversation:** When access rules prevent direct DM, conversation + MessageRequest created together; recipient sees messages on accept
- **Batch read receipt on GET messages:** Viewing messages automatically updates last_read_at; no separate mark-as-read endpoint needed
- **New message restores deleted conversations:** POST message sets deleted_at=null for soft-deleted participants to restore conversation
- **Chat media audio support:** /api/upload/chat-media accepts audio MIME types (mpeg, wav, ogg, webm, mp4, aac) for voice messages
- **Static waveform playback:** Voice playback uses static proportional bars with progress fill, not real-time AnalyserNode (standard WhatsApp approach)
- **Deterministic bar heights:** Playback bar heights from deterministic pseudo-random based on index + duration for consistent visual per message
- **Voice auto-start:** VoiceRecorder auto-starts recording on mount; user already tapped mic to enter recording mode
- **Custom chat relative timestamps:** formatRelativeTime uses now/2m/1h/Yesterday/3d format for Instagram DM-style compact display
- **Presence bulk query pattern:** usePresence emits presence:query with userIds[] on mount for single-roundtrip initial status
- **UserPicker createPortal overlay:** Full-screen user picker via createPortal to body, consistent with Modal/PostComposer pattern
- **Immersive chat page:** Chat conversation page sets ImmersiveContext to hide bottom nav; uses fixed inset-0 z-40 full-screen layout
- **Optimistic message insert:** Messages inserted with negative temp IDs, reconciled with server response on send success
- **Two-minute message grouping:** Consecutive same-sender messages within 2 min share avatar and single timestamp (Instagram DM style)
- **Typing emit debounce:** typing:start emitted immediately, typing:stop auto-sent after 2s of inactivity
- **Notification provider in authenticated layout:** SocketProvider + NotificationProvider wrap AppShell only for authenticated users
- **Safe notification badge hook:** useNotificationBadge uses raw useContext (returns 0 when null) instead of throwing useNotificationContext
- **Portal-rendered toast notifications:** NotificationToastManager uses createPortal to document.body for z-index escape
- **Notification type color coding:** Consistent mapping: reaction=pink, comment=blue, follow=green, prayer=purple, message=teal, mention=orange
- **Scheduler dual-init pattern:** Email cron scheduler initialized from socket setupNamespaces() + server.js 5s setTimeout fallback; globalThis guard prevents double-init
- **Unsubscribe JWT 90-day expiry:** Purpose-scoped JWT (purpose=email_unsubscribe) with 90-day TTL for one-click unsubscribe links
- **DM batch 30-min dedup:** DM email batch checks for recent DM email to same user within 30 minutes to prevent re-sending
- **RFC 8058 List-Unsubscribe headers:** All notification emails include List-Unsubscribe and List-Unsubscribe-Post headers for Gmail/Yahoo compliance
- **Fire-and-forget tracking pixel:** markOpened() runs async without blocking the 1x1 GIF response for email open tracking
- **Quiet hours timezone-aware:** Uses Intl.DateTimeFormat for user's IANA timezone to check if current time is within quiet hours
- **Multi-step group create flow:** GroupCreateFlow uses 2-step overlay (name+photo, then member selection) via createPortal
- **Follower-only group add:** Server validates added user is in creator's followers via Follow model check
- **System messages for membership:** Member add/remove/leave creates Message with type='system', rendered centered without bubble
- **@mention cursor detection:** MessageInput detects "@" preceded by whitespace, shows MentionPicker filtered by query after @
- **Mention notifications via createNotification:** Messages API creates MENTION type notifications for mentioned participants
- **Chat badge polling hook:** useChatUnreadBadge polls conversations every 60s + window focus for TopBar red dot
- **Per-category email toggles in settings UI:** 4 separate toggle rows for DM, follow, prayer, daily reminder emails
- **Messaging access grid in settings:** 2x2 grid selector for everyone/followers/mutual/nobody
- **Profile message button with access rules:** Creates/finds conversation on tap; disabled based on messagingAccess setting
- **Non-fatal notification creation pattern:** All createNotification() calls in API routes wrapped in try/catch
- **Social actions trigger notifications:** Follow, reaction, comment, and prayer API routes call createNotification() on success

- **VideoReaction reaction_type column:** Uses `reaction_type` matching PostReaction pattern (not `type` from plan spec)
- **Video FK RESTRICT strategy:** category_id and uploaded_by use ON DELETE RESTRICT; VideoProgress/VideoReaction use CASCADE
- **Video composite browse index:** (published, category_id, view_count) for Netflix-style category browsing queries
- **Non-fatal security alert emails:** Security alerts on credential changes wrapped in try/catch so the change succeeds even if email fails
- **Email change verify-new-first:** Token sent to new email for verification; security alert sent to old email after confirmation
- **Provider unlink requires password:** Prevents OAuth unlink if no password_hash set, avoiding account lockout
- **Provider link bidirectional check:** Same OAuth ID cannot link to multiple users; same user cannot have two accounts from one provider
- **ModerationLog updatedAt:false:** Audit logs are immutable; timestamps true with updatedAt false
- **Ban composite index (user_id, lifted_at):** Efficient active ban lookup with WHERE lifted_at IS NULL
- **ActivityStreak unique (user_id, activity_date):** One record per user per day enforced at DB level
- **Message shared_video type:** shared_video added to messages type ENUM alongside shared_post
- **Notification ENUM extension via raw SQL:** MySQL ALTER TABLE MODIFY COLUMN listing all values for ENUM changes
- **Video category count subquery literal:** SQL subquery in attributes for video count avoids N+1 on category listing
- **Netflix-style grouped video response:** Categories array + continue_watching array in single endpoint response
- **Hero video 204 pattern:** GET /api/videos/hero returns 204 No Content when no hero set (not 404 or empty object)
- **Fire-and-forget view_count:** Video.increment called without await, .catch(() => {}) silences failures
- **Fire-and-forget streak tracking:** trackActivity() called via dynamic import().then().catch() pattern; never blocks main request
- **Streak current from yesterday:** If no activity today, current streak starts from yesterday to avoid mid-day zero display
- **Date Set O(1) streak lookup:** Calculator builds Set of date strings for constant-time consecutive-day checking
- **VideoProgress cumulative upsert:** watched_seconds takes max (cumulative), last_position always updates (resume), completed is one-way true
- **VideoReaction aggregate counts:** POST toggle returns full reaction_counts object for immediate client-side UI update
- **Shared video published validation:** Chat shared_video messages validate video exists AND is published before creation
- **Grouped moderation queue:** Reports grouped by (content_type, content_id) via raw SQL GROUP BY; compound cursor (count:id) for pagination
- **Transaction-wrapped moderation actions:** All 4 actions (remove_content, warn_user, ban_user, dismiss_report) use sequelize.transaction()
- **Moderation notifications after commit:** createNotification() called after transaction.commit() in try/catch (non-fatal)
- **Active ban check pattern:** lifted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) for active ban queries
- **Repeat offenders raw SQL:** COALESCE across post/comment author joins for cross-content-type report aggregation
- **Moderation stats 7-day fill:** Missing days in moderation_activity_7d filled with zero counts for consistent chart data
- **Watch tab Play icon:** lucide-react Play icon replaces Film for Watch tab clearer semantics
- **Watch tab all-modes:** Video library visible for both bible and positivity users (removed bibleOnly)
- **Old animations redirect:** /animations page redirects to /watch for backwards compatibility
- **VideoData shared type:** VideoCard exports VideoData interface reused by HeroBanner and watch page
- **Video component directory:** src/components/video/ for all video-related UI components
- **Video player native controls:** Native HTML5 video with custom controls overlay via createPortal; no player library
- **Video progress keepalive save:** keepalive fetch on unmount for reliable progress save (preserves cookies/auth)
- **Video player dynamic import:** VideoPlayer loaded via next/dynamic for code splitting from detail page
- **useVideoReactions separate hook:** Separate from usePostReactions due to different API endpoint (video-reactions)
- **Settings API provider flags:** has_google/has_apple booleans in GET /api/settings for client-side OAuth status display
- **Settings section extraction:** ChangePasswordForm extracted from monolithic settings page into SecuritySection component
- **Danger Zone collapsible accordion:** Destructive account actions hidden behind collapsible section to prevent accidental access
- **Provider link info toast:** Link button shows info toast directing to login page rather than implementing inline OAuth flow
- **FFmpeg piped frame extraction:** Thumbnail extraction uses piped writable stream instead of temp files on disk
- **Whisper audio 64kbps mono:** Audio extraction at 64kbps mono MP3 minimizes upload size for transcription API
- **Non-fatal video processing:** Thumbnail and caption failures logged but don't fail the processing request
- **Video presigned URL 4-hour expiry:** Videos get 4-hour presigned URL expiry (vs 1-hour default) for large file uploads
- **Upload type extension maps:** ALLOWED_CONTENT_TYPES + ADMIN_ONLY_TYPES + EXPIRY_OVERRIDES in presigned route for easy type addition
- **Category reorder swap pattern:** Adjacent categories swap sort_order values via parallel PUT requests
- **Lazy tab moderation page:** 5-tab admin moderation page lazy-loads UserBrowser, BanManager, AuditLog, ModerationStats via React.lazy + Suspense
- **Action modal confirm step:** Warn and Ban require confirmation step before submission; Remove and Dismiss do not
- **Ban color-coded left border:** Red=active, amber=expiring <24h, green=lifted for quick visual scan
- **CSS bar chart for activity:** 7-day activity timeline uses inline CSS heights; no chart library dependency
- **Auth context ban redirect:** fetchUser detects 403 'Account suspended' and redirects to /banned via window.location.href
- **Server-side ban content filtering:** Feed APIs use required User include with status='active' WHERE clause
- **New video notification dedup:** Checks existing new_video notification for video before bulk send
- **SharedVideoMessage card component:** Card preview with thumbnail, play overlay, duration badge, links to /watch/[id]
- **FollowList status badges:** Deactivated (gray) and Suspended (red) tags with opacity reduction and grayscale

- **WorkshopSeries time_of_day STRING(8):** Stored as string (e.g. "19:00:00") instead of TIME type for Sequelize cross-database compatibility
- **Workshop host FK RESTRICT:** Workshop and WorkshopSeries use ON DELETE RESTRICT on host_id to prevent accidental host user deletion
- **Append-only chat/invite models:** WorkshopChat and WorkshopInvite use updatedAt:false since they are immutable records
- **Workshop notification ENUM extension:** 6 new types (reminder, cancelled, invite, recording, updated, started) + 'workshop' entity_type
- **User can_host default true:** All users can host by default; admin can revoke via setting can_host=false
- **Recording UID convention:** 900000 + workshopId to avoid collision with real user IDs in Agora channel
- **Workshop notification types in TS enums:** Extended NotificationType and NotificationEntityType to match Notification model ENUM values
- **RRULE normalization:** normalizeRRule() adds "RRULE:" prefix when missing for rrule library compatibility
- **Workshop cron globalThis guard:** initWorkshopCrons() follows established email/account cleanup pattern for HMR safety
- **No-show transaction lock:** Auto-cancel re-reads status inside transaction with LOCK.UPDATE to prevent race with host start
- **Private workshop app-layer filtering:** Private workshops filtered in JS after DB query (not SQL) for flexibility
- **Category deletion nullifies references:** Workshop category DELETE nullifies category_id on referencing workshops rather than blocking
- **Batch RSVP lookup in list:** User's RSVP status batch-fetched with IN clause to avoid N+1 queries
- **RSVP findOrCreate idempotency:** Duplicate RSVP returns existing attendee rather than error; increment only on newly created
- **Un-RSVP status guard:** Un-RSVP only allowed from 'rsvp' status; 'joined'/'left' attendees cannot be removed
- **Invite 50-user limit:** Maximum 50 userIds per invite request to prevent abuse
- **Notes 50k char limit:** Personal workshop notes capped at 50,000 characters via Zod validation
- **Chat history default 500 max 1000:** Paginated with offset_ms ASC ordering for time-synced replay
- **Workshop chat server echo:** Chat messages use server echo pattern (not optimistic) for authoritative message ID and offset_ms
- **Workshop socket rate limiting:** 10 chat messages per 5s, 5 hand raises per 10s to prevent spam
- **Auto-create attendee on public join:** Non-RSVP'd users joining public workshops get WorkshopAttendee created automatically
- **Co-host cannot remove co-host:** Only host can remove co-hosts; co-hosts can remove regular attendees
- **Two-tier attendee authorization:** Host-only for co-host promotion/demotion; host or co-host for speaker approval and attendee removal
- **Self-modification guard:** Host/co-host cannot modify own attendee properties via management endpoint
- **Fire-and-forget recording:** Cloud recording start/stop is async fire-and-forget; failures logged but don't block workshop lifecycle
- **Webhook 200 on all paths:** Recording callback always returns 200 even on errors to prevent Agora retry loops
- **Token role mapping:** Host/co-host/speaker get PUBLISHER token; regular attendees get SUBSCRIBER for receive-only
- **Start transaction lock:** SELECT FOR UPDATE inside transaction prevents race between host start and no-show cron cancel
- **Recording-to-video pipeline:** Webhook creates Video entry automatically with published=true and notifies attendees

- **Workshops replaces Bible Studies in BottomNav:** Bible Studies was placeholder; Workshops tab uses Presentation icon from lucide-react
- **CSS bar chart for dashboard trends:** Attendance trend visualized with inline CSS height percentages, no chart library (same as Phase 4 moderation stats)
- **Admin host privilege revocation:** User.can_host boolean toggled via admin PUT /api/admin/workshops with revoke_host/restore_host actions
- **Workshop cancellation notifications:** Admin cancel sends WORKSHOP_CANCELLED notification to all attendees via createNotification()

- **ChatReplay client-side time filtering:** Fetch all messages on mount, filter with useMemo by offset_ms <= currentTimeMs for smooth scrubbing
- **Series page series list lookup:** No single-series GET endpoint; fetch all series and find by ID client-side
- **series_id workshops API filter:** Added series_id query param to GET /api/workshops; skips default status filter when set

- **Host button for all users:** "Host" button shown to all authenticated users on workshop browse page; can_host not in UserData type, server validates on create
- **Workshop browse infinite scroll:** useWorkshops hook with cursor-based pagination, consistent with useFeed/usePrayerWall pattern
- **can_host added to UserData:** Client-side host privilege check added to AuthContext UserData interface; /api/auth/me already returns this field
- **Native date/time inputs:** Workshop form uses browser-native type="date" and type="time" inputs instead of third-party date picker library
- **Shared CreateWorkshopForm component:** Single form component with mode prop ('create'|'edit') handles both creation and editing flows
- **Fixed bottom action bar for workshops:** Workshop detail uses fixed bottom bar for RSVP/Join/Start/Edit actions, matching post detail pattern
- **RSVP optimistic toggle:** RSVPButton uses optimistic update with revert-on-error for instant user feedback
- **Modal-based invite (not full-screen):** InviteUsersModal uses Modal component for smaller interaction scope vs UserPicker full-screen overlay
- **Compact Twitch-style chat:** WorkshopChat uses compact line spacing with host amber/co-host indigo highlighting, not full DM bubbles
- **Attendee inline action menu:** AttendeeMenu uses inline dropdown with remove confirmation step, not full modal
- **Duration timer custom hook:** useDurationTimer extracted as reusable hook with HH:MM:SS format counting from startedAt
- **Notes fire-and-forget unmount save:** WorkshopNotes uses fire-and-forget fetch on unmount to prevent data loss during navigation

- **WorkshopRoom default export:** Required for Next.js dynamic() import compatibility (named exports break ssr:false pattern)
- **Screen share UID+100000 offset:** Separate Agora client per research; screen share UID = user.id + 100000 to avoid collision
- **Token auto-refresh 50min:** Agora tokens expire at 1 hour; proactive 50-minute refresh prevents mid-session disconnection
- **stopScreenShare ref pattern:** Ref-based stop function avoids circular useCallback dependency from track-ended handler
- **Workshop state machine hook:** useWorkshopState manages loading/lobby/live/ended/error transitions with Socket.IO integration

- **String-aware SQL parser:** Regex `[\s\S]*?;` fails on HTML content with `&nbsp;` inside SQL string literals; use findInsertStatements() with character-by-character semicolon scanning respecting quote state
- **migration-mapping.xlsx committed:** Complete 25-sheet Excel deliverable with all 24 non-workshop table mappings + orphan detection
- **Old DB data is referentially clean:** Orphan detection found 0 orphan FK references across all 24 tables
- **dailyposts is sparse index:** Old dailyposts table only has id + date string, no content columns; actual content managed externally

### Roadmap Evolution

- Phase 9 added: Platform Refinements & Admin Tools (remove laugh reactions, repost views, admin font family, activation codes, video thumbnail regen, admin workshop creation)
- 09-01: QuickReactionPicker made configurable via reactionTypes prop (shared component serves daily/prayer/post contexts with different reaction sets)

### Pending Todos

None.

### Blockers/Concerns

**Phase 1 (Foundation) Critical Items:**
- Password hash format compatibility ($2y$ to $2b$ bcrypt conversion) must be tested with actual production SQL dump during migration script development
- External PHP API dependency at kindredsplendorapi.com replaced by own DB + API.Bible fallback (established in 01-09)
- Web Push on iOS Safari requires PWA installation (added to home screen) — need to validate UX and provide fallback notification strategy
- XAMPP MySQL root password is set (not empty) — stored in .env.local; future plans should use .env.local values

**Phase 2 (Core Social) Notes:**
- Content moderation: custom report/flag system established in DB schema (reports table with 6 reason types + admin review workflow)
- obscenity library installed for profanity filtering (profanity_filter_enabled platform setting defaults to 'true')

**Phase 5 (Workshops) Planning Dependency:**
- Agora free tier limit (10K minutes/month) may need validation against expected workshop usage before phase planning

## Post-Phase 1 QA Fixes Applied

- Default theme changed to "light" (was "system")
- Guest daily post access: unauthenticated visitors see daily post without nav, with sign-up/sign-in CTA
- withOptionalAuth middleware added for guest-accessible API routes
- Appearance persistence fixed: DB dark_mode syncs to next-themes on settings load
- Profile page theme toggle now persists to DB
- MySQL root password restored to original (was changed by agent during setup)
- DB_PASS in .env.local must be quoted due to # character
- Commit: 42e119f

## Post-Phase 1 Feature Polish (2026-02-12)

**Reactions & Comments system:**
- DB: daily_reactions + daily_comments tables (migrations 014, 015)
- Models: DailyReaction, DailyComment with associations
- API: daily-reactions (GET counts + POST toggle), daily-comments (GET paginated + POST), daily-comments/[id] (PUT edit + DELETE)
- Hooks: useReactions (optimistic updates), useComments (paginated with load-more)
- UI: ReactionBar (overlapping emoji counts), ReactionPicker (full overlay), QuickReactionPicker (Meta-style floating bubble), CommentBottomSheet + CommentThread (threaded with replies)
- Integration: Heart/comment icons with counters on DailyPostSlide

**Daily slide polish:**
- Video preloading: useDailyContent preloads video before setContent; DailyPostSlide gates on videoReady with spinner + fade-in
- Dark loading state: bg-[#0a0a0f] base instead of blue gradient during transitions
- Removed loading text from carousel spinner state

**Language selector:**
- Moved from per-slide TranslationSwitcher to global TopBar
- Changed from toggle to dropdown picker (supports future languages)
- LANGUAGE_OPTIONS config in constants.ts for easy extension
- Cookie regex + API validation use LANGUAGES array (not hardcoded en|es)

**Notification bell:**
- Dropdown with empty state ("No notifications yet") on click
- Mutual exclusion with language dropdown

**Liquid glass styling:**
- CommentBottomSheet: bg-white/10 backdrop-blur-2xl with white-on-glass text
- CommentThread: all elements restyled for glass background
- Language dropdown: matches TranslationSwitcher glass style
- Notification dropdown: same glass treatment

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 09-01-PLAN.md (UX refinements: reactions, view badges, thumbnails)
Resume file: None
