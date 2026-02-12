# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Daily inspirational content delivery and faith-based community connection — users come back every day for their daily post and stay to engage with their community.

**Current focus:** Phase 1 - Foundation (COMPLETE)

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 12 of 12 complete
Status: Phase complete
Last activity: 2026-02-12 — Completed 01-11-PLAN.md (Settings & Email)

Progress: [████████████] 12/12 plans (100%)

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 5 min
- Total execution time: 63 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 12/12 | 63 min | 5 min |

**Recent Trend:**
- Last 5 plans: 01-08 (4 min), 01-06 (6 min), 01-07 (5 min), 01-10 (5 min), 01-11 (7 min)
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

### Pending Todos

None.

### Blockers/Concerns

**Phase 1 (Foundation) Critical Items:**
- Password hash format compatibility ($2y$ to $2b$ bcrypt conversion) must be tested with actual production SQL dump during migration script development
- External PHP API dependency at kindredsplendorapi.com replaced by own DB + API.Bible fallback (established in 01-09)
- Web Push on iOS Safari requires PWA installation (added to home screen) — need to validate UX and provide fallback notification strategy
- XAMPP MySQL root password is set (not empty) — stored in .env.local; future plans should use .env.local values

**Phase 2 (Core Social) Pre-work:**
- Content moderation tooling approach needs decision during planning (custom report/flag system vs third-party API like OpenAI Moderation)

**Phase 5 (Workshops) Planning Dependency:**
- Agora free tier limit (10K minutes/month) may need validation against expected workshop usage before phase planning

## Session Continuity

Last session: 2026-02-12T06:43:00Z
Stopped at: Completed 01-11-PLAN.md (Settings & Email) -- Phase 1 Foundation COMPLETE
Resume file: None
