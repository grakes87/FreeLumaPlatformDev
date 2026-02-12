---
phase: 01-foundation
plan: 06
subsystem: auth-ui
tags: [login-page, signup-page, oauth, google-signin, apple-signin, react-hook-form, zod, activation-codes, social-auth]

# Dependency graph
requires:
  - phase: 01-foundation/01-04
    provides: "AuthContext, useAuth hook, route groups, public layout, UI components"
  - phase: 01-foundation/01-05
    provides: "Auth API endpoints (register, login, logout, me), JWT, validation schemas"
provides:
  - "Login page with email/password form and social OAuth buttons"
  - "Multi-step signup page: activation code validation -> credentials + DOB + terms"
  - "Google OAuth: client-side @react-oauth/google button + server-side verification + find-or-create user"
  - "Apple OAuth: client-side Apple JS SDK button + server-side apple-signin-auth verification + find-or-create user"
  - "Graceful degradation when OAuth credentials not configured (disabled buttons)"
  - "SocialDivider and ActivationCodeStep reusable auth components"
  - "Updated registerSchema with date_of_birth and terms_accepted fields"
  - "signupCredentialsSchema for client-side form validation"
affects: [01-07, 01-08, 01-09, 01-10, 02-core-social]

# Tech tracking
tech-stack:
  added: []
  patterns: [google-oauth-popup-flow, apple-js-sdk-popup-flow, oauth-find-or-create, social-account-linking, activation-code-for-oauth-signup]

key-files:
  created:
    - src/app/(public)/login/page.tsx
    - src/app/(public)/signup/page.tsx
    - src/components/auth/LoginForm.tsx
    - src/components/auth/SignupForm.tsx
    - src/components/auth/ActivationCodeStep.tsx
    - src/components/auth/SocialDivider.tsx
    - src/components/auth/GoogleButton.tsx
    - src/components/auth/AppleButton.tsx
    - src/app/api/auth/google/route.ts
    - src/app/api/auth/apple/route.ts
    - src/lib/auth/google.ts
    - src/lib/auth/apple.ts
  modified:
    - src/app/(public)/layout.tsx
    - src/lib/utils/validation.ts
    - src/app/api/auth/register/route.ts

key-decisions:
  - "GoogleOAuthProvider wraps GoogleButton component (not public layout) for isolation"
  - "Apple JS SDK loaded dynamically via script tag, initialized in useEffect"
  - "OAuth new-user signup requires activation code (same as email/password flow)"
  - "Account linking: existing users found by email automatically get google_id/apple_id linked"
  - "Temporary username generated from email prefix for OAuth signups (user can change in onboarding)"
  - "registerSchema extended with date_of_birth and terms_accepted fields"
  - "signupCredentialsSchema separate for client-side form validation (excludes activation_code)"

patterns-established:
  - "OAuth find-or-create: check by social ID -> check by email (link) -> new user (require activation code)"
  - "Social buttons graceful degradation: check NEXT_PUBLIC_*_CLIENT_ID, render disabled if missing"
  - "AuthProvider wraps public login/signup pages for useAuth hook access"
  - "Password requirements UI: live checkmarks for each requirement as user types"

# Metrics
duration: 6min
completed: 2026-02-12
---

# Phase 1 Plan 6: Login/Signup Pages & OAuth Summary

**Login and signup pages with react-hook-form + zod validation, multi-step signup (activation code -> credentials + DOB + terms), Google OAuth via @react-oauth/google, Apple OAuth via Apple JS SDK + apple-signin-auth, graceful degradation when credentials not configured**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-12T06:23:07Z
- **Completed:** 2026-02-12T06:29:12Z
- **Tasks:** 2/2
- **Files created:** 12
- **Files modified:** 3

## Accomplishments

- Login page with branded header ("Free Luma"), email/password form using react-hook-form + zod validation, forgot password link, signup link
- Multi-step signup page: Step 1 validates activation code (auto-fills from URL query param), Step 2 collects email, display name, @username, password (with live requirement indicators), date of birth, and terms acceptance checkbox
- SocialDivider component with horizontal rule and "or" text
- ActivationCodeStep reusable component with server-side validation against /api/activation-codes/validate
- Google Sign-In button using @react-oauth/google GoogleLogin component with GoogleOAuthProvider wrapper, popup-based auth flow
- Apple Sign-In button using Apple JS SDK (dynamically loaded), popup-based auth flow
- POST /api/auth/google endpoint: verifies Google ID token using google-auth-library OAuth2Client, implements find-by-google_id -> find-by-email (link) -> create new user flow
- POST /api/auth/apple endpoint: verifies Apple identity token using apple-signin-auth, handles relay emails, same find-or-create pattern
- Both OAuth endpoints require activation code for new user signups (consistent with invite-only model)
- Both OAuth buttons gracefully degrade to disabled state when NEXT_PUBLIC credentials not set
- Updated registerSchema to include date_of_birth and terms_accepted fields
- Updated /api/auth/register to persist date_of_birth on user creation
- Build passes with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Login page, signup page, and auth form components** - `0fc0067` (feat)
2. **Task 2: Google and Apple OAuth integration** - `8ac4027` (feat)

## Files Created/Modified

- `src/app/(public)/login/page.tsx` - Login page with form, social buttons, AuthProvider wrapper
- `src/app/(public)/signup/page.tsx` - Signup page with multi-step form, social buttons
- `src/components/auth/LoginForm.tsx` - Login form with react-hook-form + zod, error handling, navigation
- `src/components/auth/SignupForm.tsx` - Multi-step signup: activation code -> credentials with DOB and terms
- `src/components/auth/ActivationCodeStep.tsx` - Activation code input with URL auto-fill and server validation
- `src/components/auth/SocialDivider.tsx` - Horizontal divider with "or" text
- `src/components/auth/GoogleButton.tsx` - Google Sign-In with @react-oauth/google, fallback disabled state
- `src/components/auth/AppleButton.tsx` - Apple Sign-In with JS SDK dynamic loading, fallback disabled state
- `src/app/api/auth/google/route.ts` - Google OAuth verify + find-or-create user endpoint
- `src/app/api/auth/apple/route.ts` - Apple OAuth verify + find-or-create user endpoint
- `src/lib/auth/google.ts` - Google credential verification with OAuth2Client
- `src/lib/auth/apple.ts` - Apple identity token verification with apple-signin-auth
- `src/app/(public)/layout.tsx` - Added vertical padding for auth pages
- `src/lib/utils/validation.ts` - Added date_of_birth, terms_accepted to registerSchema + signupCredentialsSchema
- `src/app/api/auth/register/route.ts` - Updated to accept and persist date_of_birth

## Decisions Made

- **GoogleOAuthProvider scoping:** Wraps only the GoogleButton component rather than the entire public layout, preventing unnecessary Google SDK loading on non-auth pages.
- **Apple JS SDK dynamic loading:** Script loaded via `document.createElement('script')` in useEffect, initialized after load event, using popup mode for best UX.
- **OAuth activation code enforcement:** New users via OAuth must provide activation code, consistent with the invite-only platform model. Existing users (found by social ID or email) skip activation code.
- **Account linking on email match:** If a user registered with email/password and later signs in with Google/Apple using the same email, their social ID is automatically linked to the existing account.
- **Temporary username for OAuth:** OAuth signups generate a temporary username from the email prefix (e.g., `john_doe` from `john.doe@gmail.com`). Users set their preferred username during onboarding.
- **registerSchema extension:** Added `date_of_birth` (required YYYY-MM-DD format) and `terms_accepted` (must be true) to the registration validation schema, with a separate `signupCredentialsSchema` for client-side form validation that excludes activation_code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added date_of_birth and terms_accepted to registerSchema**
- **Found during:** Task 1 implementation
- **Issue:** The plan specified DOB and terms checkbox in the signup form, but the existing registerSchema from 01-05 did not include these fields
- **Fix:** Extended registerSchema with date_of_birth (required date string) and terms_accepted (boolean, must be true). Created separate signupCredentialsSchema for client-side form without activation_code field.
- **Files modified:** `src/lib/utils/validation.ts`, `src/app/api/auth/register/route.ts`
- **Commit:** 0fc0067

**2. [Rule 2 - Missing Critical] Added NEXT_PUBLIC env vars to .env.local**
- **Found during:** Task 1 implementation
- **Issue:** Google and Apple client IDs need NEXT_PUBLIC_ prefix for client-side access, but .env.local only had server-side versions
- **Fix:** Added NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_APPLE_CLIENT_ID to .env.local (not committed -- .env.local is gitignored)
- **Files modified:** `.env.local`
- **Note:** .env.local is gitignored so this is not in the commit

## User Setup Required

Google OAuth and Apple Sign-In require external service configuration. See:
`.planning/phases/01-foundation/01-06-USER-SETUP.md`

Both are optional -- the app works with email/password when OAuth is not configured.

## Next Phase Readiness

- Login and signup pages ready for user testing
- OAuth infrastructure in place for Google and Apple (needs credentials to fully test)
- Auth form components (LoginForm, SignupForm, ActivationCodeStep) can be referenced by future plans
- Registration now captures date_of_birth for future age-gated features
- Terms acceptance tracked at registration time
- Social account linking established for users who may sign up with email first, then connect social later

---
*Phase: 01-foundation*
*Completed: 2026-02-12*
