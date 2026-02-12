# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Daily inspirational content delivery and faith-based community connection — users come back every day for their daily post and stay to engage with their community.

**Current focus:** Phase 2 - Core Social (In progress)

## Current Position

Phase: 2 of 6 (Core Social)
Plan: 9 of 14 complete
Status: In progress
Last activity: 2026-02-12 — Completed 02-06-PLAN.md (Feed API - Following + FYP)

Progress: [█████████░░░░░] 9/14 plans (64%)

## Performance Metrics

**Velocity:**
- Total plans completed: 21
- Average duration: 5 min
- Total execution time: 100 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 12/12 | 63 min | 5 min |
| 02-core-social | 9/14 | 37 min | 4 min |

**Recent Trend:**
- Last 5 plans: 02-05 (5 min), 02-07 (3 min), 02-08 (4 min), 02-09 (4 min), 02-06 (5 min)
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
- **BottomNav mode filtering:** Animations tab hidden for positivity mode users; 6 tabs (bible) / 5 tabs (positivity)
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

Last session: 2026-02-12T20:21:00Z
Stopped at: Completed 02-06-PLAN.md (Feed API - Following + FYP)
Resume file: None
