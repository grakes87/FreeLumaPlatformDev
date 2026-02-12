# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Daily inspirational content delivery and faith-based community connection — users come back every day for their daily post and stay to engage with their community.

**Current focus:** Phase 1 - Foundation

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 5 of 12 complete
Status: In progress
Last activity: 2026-02-12 — Completed 01-05-PLAN.md (Authentication System)

Progress: [████▓░░░░░░░] 5/12 plans (42%)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 6 min
- Total execution time: 28 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 5/12 | 28 min | 6 min |

**Recent Trend:**
- Last 5 plans: 01-01 (8 min), 01-03 (3 min), 01-02 (5 min), 01-04 (5 min), 01-05 (7 min)
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

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 (Foundation) Critical Items:**
- Password hash format compatibility ($2y$ to $2b$ bcrypt conversion) must be tested with actual production SQL dump during migration script development
- External PHP API dependency at kindredsplendorapi.com for daily content needs caching fallback pattern established
- Web Push on iOS Safari requires PWA installation (added to home screen) — need to validate UX and provide fallback notification strategy
- XAMPP MySQL root password is set (not empty) — stored in .env.local; future plans should use .env.local values

**Phase 2 (Core Social) Pre-work:**
- Content moderation tooling approach needs decision during planning (custom report/flag system vs third-party API like OpenAI Moderation)

**Phase 5 (Workshops) Planning Dependency:**
- Agora free tier limit (10K minutes/month) may need validation against expected workshop usage before phase planning

## Session Continuity

Last session: 2026-02-12T06:20:11Z
Stopped at: Completed 01-05-PLAN.md (Authentication System)
Resume file: None
