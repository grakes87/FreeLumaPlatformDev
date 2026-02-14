---
phase: "04-enhanced-content"
plan: 12
subsystem: "settings-ui"
tags: ["settings", "account-lifecycle", "streaks", "security", "oauth", "danger-zone"]
depends_on:
  requires: ["04-03", "04-06", "04-07"]
  provides: ["Account stats UI", "Email/password change forms", "OAuth link/unlink UI", "Account deactivation/deletion UI"]
  affects: []
tech-stack:
  added: []
  patterns: ["Collapsible settings sections", "Form submission with success/error states", "Modal confirmation for destructive actions"]
key-files:
  created:
    - src/components/settings/StatsPage.tsx
    - src/components/settings/SecuritySection.tsx
    - src/components/settings/ConnectedAccountsSection.tsx
    - src/components/settings/DangerZone.tsx
  modified:
    - src/app/(app)/settings/page.tsx
    - src/app/api/settings/route.ts
decisions:
  - id: "settings-section-extraction"
    choice: "Extracted ChangePasswordForm from monolithic settings page into SecuritySection component"
    reason: "Keeps settings page manageable and separates concerns by domain"
  - id: "provider-link-info-toast"
    choice: "Link button shows info toast directing to login page rather than inline OAuth flow"
    reason: "OAuth link requires full provider SDK setup; simpler to reuse existing login flow"
  - id: "danger-zone-collapsible"
    choice: "Danger Zone uses collapsible accordion to prevent accidental visibility"
    reason: "Destructive actions should be hidden by default to prevent accidental clicks"
  - id: "settings-api-provider-flags"
    choice: "Added has_google/has_apple boolean flags to GET /api/settings response"
    reason: "Client needs to know provider link status without fetching full user object"
metrics:
  duration: "7 min"
  completed: "2026-02-14"
---

# Phase 04 Plan 12: Account Lifecycle Settings UI Summary

Account stats page with streak cards, email/password change forms in SecuritySection, Google/Apple provider management, and Danger Zone with deactivation/deletion modals.

## What Was Built

### Task 1: Account Stats Page with Streak Cards
- **StatsPage** component fetching GET /api/account/stats
- Three card-based sections: Account Info, Activity grid, Streak display
- Account Info: join date, email, content mode badge
- Activity: 3x2 grid with posts, comments, reactions, prayers, followers, following
- Streak: prominent current streak with flame icon, longest streak, total active days
- Full loading skeleton states for all cards
- Expandable "Account Stats" section added to settings page

### Task 2: Security Section + Connected Accounts
- **SecuritySection** with email change form (POST /api/auth/change-email) and password change form
- Email change: shows current email, new email input, verification flow with success message
- Password change: current + new + confirm fields with Zod validation
- Error handling: 409 email taken, 429 rate limit, 400 invalid
- **ConnectedAccountsSection** showing Google/Apple provider status with link/unlink buttons
- Unlink calls POST /api/auth/unlink-provider with error handling for no-password case
- Settings API extended to return has_google/has_apple boolean flags
- Cleaned up monolithic settings page: removed inline ChangePasswordForm, unused imports

### Task 3: Danger Zone
- **DangerZone** component with red-bordered card and collapsible accordion
- Deactivate Account: description + confirmation modal, POST /api/account/deactivate, auto-logout
- Delete Account: description + password confirmation modal, POST /api/account/delete, 30-day grace period
- Both actions clear auth and redirect to login
- Placed at bottom of settings under "Account Management" header

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added has_google/has_apple to settings API**
- **Found during:** Task 2
- **Issue:** Settings API did not return OAuth provider connection status needed by ConnectedAccountsSection
- **Fix:** Extended GET /api/settings to include google_id/apple_id in user query and return has_google/has_apple booleans
- **Files modified:** src/app/api/settings/route.ts
- **Commit:** daed96b

**2. [Rule 2 - Missing Critical] Extracted ChangePasswordForm to avoid duplication**
- **Found during:** Task 2
- **Issue:** Settings page had an inline ChangePasswordForm; creating SecuritySection with same functionality would duplicate code
- **Fix:** Removed inline ChangePasswordForm from settings page, moved to SecuritySection component
- **Files modified:** src/app/(app)/settings/page.tsx
- **Commit:** daed96b

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 989b830 | feat | Account stats page with streak cards |
| daed96b | feat | Security section + connected accounts management |
| 77d470b | feat | Danger zone with account deactivation and deletion |

## Verification

- TypeScript compilation: No errors in any new/modified files
- All 4 component files created with proper exports
- Settings page integrates all new sections in correct order
- API endpoint extended with provider status flags
- All must_haves satisfied:
  - Account stats with streaks viewable
  - Email change with verification flow
  - Password change with confirmation
  - OAuth provider link/unlink
  - Account deactivation from settings
  - Account deletion from Danger Zone
