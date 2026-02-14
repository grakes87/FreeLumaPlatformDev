---
phase: 04-enhanced-content
plan: 03
subsystem: auth
tags: [jwt, email, oauth, bcryptjs, security, account-management]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "withAuth middleware, jose JWT, bcryptjs password hashing, email templates, Google/Apple OAuth verification"
provides:
  - "POST /api/auth/change-email with purpose-scoped JWT verification flow"
  - "GET /api/auth/verify-email-change token confirmation endpoint"
  - "POST /api/auth/change-password with security alert email"
  - "POST /api/auth/link-provider for Google/Apple OAuth linking"
  - "POST /api/auth/unlink-provider with lockout prevention"
  - "emailChangeVerificationTemplate, emailChangeAlertTemplate, passwordChangeAlertTemplate"
affects: ["settings-ui", "account-management-frontend", "profile-security"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Purpose-scoped JWT for email change verification (purpose='email_change')"
    - "Security alert email on credential changes (non-fatal send)"
    - "OAuth provider lockout prevention (require password before unlink)"

key-files:
  created:
    - "src/app/api/auth/change-email/route.ts"
    - "src/app/api/auth/verify-email-change/route.ts"
    - "src/app/api/auth/link-provider/route.ts"
    - "src/app/api/auth/unlink-provider/route.ts"
  modified:
    - "src/app/api/auth/change-password/route.ts"
    - "src/lib/email/templates.ts"
    - "src/lib/email/index.ts"

key-decisions:
  - "Security alert emails are non-fatal: wrapped in try/catch so credential change succeeds even if email fails"
  - "Email change verifies at new address: token sent to new email, security alert sent to old email"
  - "Unlink provider requires password: prevents lockout by ensuring at least one auth method remains"
  - "Link provider checks both directions: prevents same OAuth ID linked to multiple users AND same user having two different accounts from one provider"

patterns-established:
  - "Non-fatal security alert pattern: try/catch around sendEmail for credential change alerts"
  - "Provider lockout check: verify password_hash exists before allowing OAuth unlink"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 4 Plan 3: Account Credential Management APIs Summary

**Email change with verify-new-first JWT flow, password change with security alerts, and OAuth provider link/unlink with lockout prevention**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T06:37:57Z
- **Completed:** 2026-02-14T06:41:19Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Email change flow: request generates purpose-scoped JWT, sends verification to new email, confirmation updates email and alerts old email
- Password change enhanced with security alert email notification
- OAuth provider linking with server-side token verification (Google and Apple)
- OAuth provider unlinking with lockout prevention (requires password set)
- Three new email templates: email change verification, email change alert, password change alert

## Task Commits

Each task was committed atomically:

1. **Task 1: Email change API with verification flow** - `38b71d0` (feat)
2. **Task 2: Password change alert + OAuth provider link/unlink APIs** - `3bde8a7` (feat)

## Files Created/Modified
- `src/app/api/auth/change-email/route.ts` - POST endpoint to initiate email change with purpose-scoped JWT
- `src/app/api/auth/verify-email-change/route.ts` - GET endpoint to confirm email change via token, updates email, sends security alert
- `src/app/api/auth/change-password/route.ts` - Added security alert email on password change (existing route enhanced)
- `src/app/api/auth/link-provider/route.ts` - POST endpoint to link Google/Apple OAuth with server-side token verification
- `src/app/api/auth/unlink-provider/route.ts` - POST endpoint to unlink OAuth provider with lockout prevention
- `src/lib/email/templates.ts` - Added emailChangeVerificationTemplate, emailChangeAlertTemplate, passwordChangeAlertTemplate
- `src/lib/email/index.ts` - Added sendEmailChangeVerification, sendPasswordChangeAlert helpers + verify-email-change URL in dev console

## Decisions Made
- Security alert emails are non-fatal: wrapped in try/catch so credential changes succeed even if email delivery fails
- Email change flow verifies at the new address first (token sent to new email), then alerts old email after confirmation
- Provider unlink requires password_hash to exist, preventing users from removing their only sign-in method
- Link provider checks both directions: same OAuth ID cannot be linked to multiple users, and a user cannot link two different accounts from the same provider
- Rate limit on email change: 3 requests per hour per user (matches send-verification pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Race condition guard on verify-email-change**
- **Found during:** Task 1
- **Issue:** New email could be claimed by another user between token issuance and confirmation
- **Fix:** Added check for existing user with new_email before updating, redirects to error if taken
- **Files modified:** src/app/api/auth/verify-email-change/route.ts
- **Verification:** Redirect to settings?error=email_already_taken when new email already claimed

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential race condition guard for correctness. No scope creep.

## Issues Encountered
- change-password route already existed from Phase 1 -- enhanced it with security alert email import and non-fatal send rather than creating from scratch

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 credential management API routes operational
- Email templates ready for both dev (console) and production (SMTP) environments
- Routes ready for settings UI integration in frontend plans

---
*Phase: 04-enhanced-content*
*Completed: 2026-02-14*
