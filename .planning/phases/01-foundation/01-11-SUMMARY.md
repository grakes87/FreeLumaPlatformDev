---
phase: 01-foundation
plan: 11
subsystem: settings-email
tags: [nodemailer, settings, password-reset, email-verification, jwt, dark-mode, preferences, zod]

# Dependency graph
requires:
  - phase: 01-foundation/01-05
    provides: "JWT sign/verify, withAuth middleware, bcryptjs password hashing, rate limiting, validation schemas"
  - phase: 01-foundation/01-08
    provides: "Profile page with settings list stubs, AuthContext with UserData interface"
provides:
  - "Nodemailer email infrastructure with SMTP transport and console dev fallback"
  - "HTML email templates with Free Luma branding (password reset, email verification)"
  - "Complete password reset flow (forgot-password -> email -> reset-password -> new password)"
  - "Change password endpoint with current password verification"
  - "Full settings page with all preference controls (theme, mode, language, translation, notifications)"
  - "Auto-saving settings with debounced PUT and toast feedback"
  - "Email verification flow (send-verification -> verify-email -> redirect)"
  - "VerifyEmailBanner component for unverified users (dismissable, sessionStorage)"
  - "GET/PUT /api/settings merging UserSetting and User preferences"
affects: [02-core-social, 06-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [nodemailer-console-fallback, signed-jwt-for-email-tokens, debounced-auto-save, toggle-switch-pattern]

key-files:
  created:
    - src/lib/email/index.ts
    - src/lib/email/templates.ts
    - src/app/api/auth/forgot-password/route.ts
    - src/app/api/auth/reset-password/route.ts
    - src/app/api/auth/change-password/route.ts
    - src/app/api/auth/send-verification/route.ts
    - src/app/api/auth/verify-email/route.ts
    - src/app/api/settings/route.ts
    - src/app/(app)/settings/page.tsx
    - src/app/(public)/forgot-password/page.tsx
    - src/app/(public)/reset-password/page.tsx
    - src/components/common/VerifyEmailBanner.tsx
  modified:
    - src/app/(app)/profile/page.tsx
    - src/components/layout/AppShell.tsx

key-decisions:
  - "Signed JWT tokens for password reset (1h) and email verification (24h) instead of DB-stored tokens -- no additional columns needed"
  - "Console email fallback: when SMTP_HOST not configured, emails are logged to console with extracted action URLs for easy dev testing"
  - "Settings API merges UserSetting (dark_mode, push, email_notifications, daily_reminder_time) with User (mode, language, preferred_translation, timezone) in single endpoint"
  - "Debounced auto-save: settings changes fire a 500ms debounced PUT with optimistic UI update and toast feedback"
  - "Mode switch requires confirmation dialog before saving to prevent accidental content type changes"

patterns-established:
  - "Email sending pattern: sendEmail(to, subject, html) with transporter null check for dev fallback"
  - "Purpose-scoped JWTs: purpose field in JWT payload (password_reset, email_verification) prevents token misuse across flows"
  - "Auto-save settings pattern: optimistic update + debounced PUT + toast confirmation"
  - "Toggle switch component: custom accessible switch with role=switch, aria-checked, slide animation"

# Metrics
duration: 7min
completed: 2026-02-12
---

# Phase 1 Plan 11: Settings & Email Summary

**Nodemailer email infrastructure with console dev fallback, complete password reset flow via signed JWT links, full settings page with auto-saving preferences (theme, mode, language, translation, notifications), change password with current verification, and email verification banner**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-12T06:35:47Z
- **Completed:** 2026-02-12T06:43:00Z
- **Tasks:** 2/2
- **Files created/modified:** 14

## Accomplishments

- Nodemailer email service with SMTP transport and graceful console fallback for development (logs email content and action URLs)
- HTML email templates with Free Luma branding for password reset and email verification
- Complete password reset flow: forgot-password form -> API generates signed JWT (1h expiry) -> sends email -> reset-password page validates token -> updates password hash and clears account locks
- Change password endpoint verifying current password before accepting new one (handles social-login-only accounts gracefully)
- Full settings page with 5 sections: Account (email display + change password), Appearance (light/dark/system theme), Content Preferences (mode toggle with confirmation + translation dropdown + language toggle), Notifications (push/email toggles + daily reminder time picker + quiet hours coming soon), About (logout + version + legal links)
- All settings auto-save on change with 500ms debounced PUT and "Saved" toast feedback
- Email verification flow: POST /api/auth/send-verification (rate-limited, 24h JWT) + GET /api/auth/verify-email (validates token, sets email_verified=true, redirects)
- VerifyEmailBanner component: amber warning banner for unverified users with "Verify" button and X dismiss (sessionStorage persistence), integrated into AppShell above page content
- Profile page settings items now navigate to /settings instead of showing "Coming soon" toasts
- Build passes with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Email infrastructure, password reset flow** - `781fe1b` (feat)
2. **Task 2: Settings page, change password, verify email banner, email verification** - `b99848f` (feat)

## Files Created/Modified

- `src/lib/email/index.ts` - Nodemailer transporter with SMTP config, console fallback, sendEmail/sendPasswordResetEmail/sendVerificationEmail
- `src/lib/email/templates.ts` - HTML email templates: passwordResetTemplate, verificationTemplate with base layout and action buttons
- `src/app/api/auth/forgot-password/route.ts` - POST: rate-limited (3/hr per email), generates 1h signed JWT, sends reset email, always returns 200
- `src/app/api/auth/reset-password/route.ts` - POST: verifies JWT purpose=password_reset, validates new password, hashes and updates, clears locks
- `src/app/api/auth/change-password/route.ts` - POST: protected, verifies current password, hashes and updates new password
- `src/app/api/auth/send-verification/route.ts` - POST: protected, rate-limited (3/hr), generates 24h signed JWT, sends verification email
- `src/app/api/auth/verify-email/route.ts` - GET: verifies JWT purpose=email_verification, sets email_verified=true, redirects to /profile
- `src/app/api/settings/route.ts` - GET/PUT: protected, merges UserSetting + User fields, Zod validation, creates default settings if needed
- `src/app/(app)/settings/page.tsx` - Full settings page with 5 sections, auto-save, mode confirmation, change password inline form
- `src/app/(public)/forgot-password/page.tsx` - Email input form with success state showing "Check your email" message
- `src/app/(public)/reset-password/page.tsx` - Token from URL, new password + confirm form, success state with auto-redirect to login
- `src/components/common/VerifyEmailBanner.tsx` - Dismissable amber banner for unverified users
- `src/app/(app)/profile/page.tsx` - Modified: settings items navigate to /settings via router.push, removed useToast import
- `src/components/layout/AppShell.tsx` - Modified: added VerifyEmailBanner between TopBar and main content (non-daily pages)

## Decisions Made

- **Signed JWT tokens for email flows:** Used purpose-scoped JWTs (purpose: 'password_reset' with 1h expiry, purpose: 'email_verification' with 24h expiry) instead of storing tokens in DB columns. This avoids schema changes and the JWT signature prevents tampering. The same JWT_SECRET is used for all token types but the purpose field prevents cross-flow token reuse.
- **Console email fallback:** When SMTP_HOST is not set, emails are logged to console with extracted action URLs. This allows full development and testing of the reset/verification flows without SMTP configuration.
- **Merged settings endpoint:** Single GET/PUT /api/settings that reads/writes both UserSetting table (dark_mode, push_enabled, email_notifications, daily_reminder_time) and User table (mode, language, preferred_translation, timezone). Frontend doesn't need to know which table stores what.
- **Mode switch confirmation:** Changing mode (Bible/Positivity) shows a confirmation prompt before saving, since it changes the user's entire daily content experience.
- **Debounced auto-save:** 500ms debounce prevents rapid-fire API calls when toggling multiple settings in quick succession. Optimistic UI update makes changes feel instant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] AppShell already had VerifyEmailBanner from plan 01-10**
- **Found during:** Task 2 (AppShell integration)
- **Issue:** The 01-10 plan had already committed the VerifyEmailBanner import and integration into AppShell.tsx, but had not committed the actual VerifyEmailBanner.tsx component file.
- **Fix:** Created the component file as planned; the AppShell integration was already in place so no additional AppShell changes were needed.
- **Files modified:** src/components/common/VerifyEmailBanner.tsx (created)
- **Committed in:** b99848f (Task 2 commit)

---

**Total deviations:** 1 (pre-existing forward reference from 01-10)
**Impact on plan:** Minimal. The forward reference was harmless since it was gated behind null checks in the component.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** See [01-11-USER-SETUP.md](./01-11-USER-SETUP.md) for:
- SMTP environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- Dashboard configuration for email provider
- The app works fully without SMTP configured (emails logged to console)

## Next Phase Readiness

- Email infrastructure ready for any future email needs (welcome emails, notifications, etc.)
- Settings page ready to add new preference sections as features are built
- Password reset flow complete end-to-end (pending SMTP for real email delivery)
- Email verification flow integrated into app shell via banner
- Profile page settings links all point to functional /settings page

---
*Phase: 01-foundation*
*Completed: 2026-02-12*
