---
phase: 01-foundation
plan: 08
subsystem: storage-profile
tags: [backblaze-b2, s3-client, presigned-urls, avatar-upload, react-easy-crop, profile-card, settings]

# Dependency graph
requires:
  - phase: 01-foundation/01-02
    provides: "User model with avatar_url, avatar_color, bio fields"
  - phase: 01-foundation/01-04
    provides: "AppShell, AuthContext, useAuth hook, Card/Modal/Button/Toast components"
provides:
  - "S3Client configured for Backblaze B2 with graceful degradation"
  - "Presigned URL generation for direct browser-to-B2 uploads"
  - "Avatar upload flow: file select -> crop -> presigned upload -> confirm"
  - "InitialsAvatar component with curated color palette"
  - "ProfileCard with avatar, name, username, bio"
  - "Profile page with settings list (working logout, dark mode toggle)"
  - "GET /api/upload/presigned and POST /api/upload/avatar endpoints"
affects: [01-09, 01-10, 01-11, 01-12, 02-core-social, 06-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [presigned-url-upload, canvas-crop-to-blob, graceful-degradation-503]

key-files:
  created:
    - src/lib/storage/b2.ts
    - src/lib/storage/presign.ts
    - src/app/api/upload/presigned/route.ts
    - src/app/api/upload/avatar/route.ts
    - src/components/profile/InitialsAvatar.tsx
    - src/components/profile/AvatarCrop.tsx
    - src/components/profile/AvatarUpload.tsx
    - src/components/profile/ProfileCard.tsx
  modified:
    - src/app/(app)/profile/page.tsx
    - src/context/AuthContext.tsx

key-decisions:
  - "B2 client is null when env vars missing (not a crash); isB2Configured boolean guards all storage operations"
  - "Presigned URL endpoint returns 503 when B2 not configured; client shows info toast"
  - "Avatar key format: avatars/{userId}/{timestamp}-{random}.jpg -- validated server-side to prevent cross-user writes"
  - "Canvas API getCroppedImage helper produces 256x256 JPEG at 0.9 quality (client-side, no sharp dependency)"
  - "Profile page settings items are stubs with 'Coming soon' toast (except logout and appearance which work)"

patterns-established:
  - "Presigned URL upload pattern: GET presigned URL -> PUT to B2 -> POST confirm to API"
  - "Graceful storage degradation: 503 from API -> toast message to user -> initials avatar fallback"
  - "Avatar crop modal pattern: file input -> FileReader data URL -> react-easy-crop -> canvas toBlob"
  - "Settings list pattern: array of items with icon, label, optional action/href, renders in Card"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 1 Plan 08: B2 Storage & Avatar Upload Summary

**S3-compatible B2 client with presigned URL uploads, avatar crop/upload flow using react-easy-crop, ProfileCard component, and profile page with settings list (working logout and dark mode toggle)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T06:23:29Z
- **Completed:** 2026-02-12T06:26:59Z
- **Tasks:** 2/2
- **Files created/modified:** 10

## Accomplishments

- Backblaze B2 S3Client with graceful degradation (null client + isB2Configured flag when env vars missing)
- Presigned URL generator supporting upload (PUT) and download (GET) with CDN URL construction
- Upload key generation: `{type}/{userId}/{timestamp}-{random}.{ext}` format
- GET /api/upload/presigned endpoint with auth, type validation, content type validation, admin-only type checks
- POST /api/upload/avatar endpoint validates key ownership, updates user.avatar_url in database
- InitialsAvatar component extracting up to 2 initials from display name with curated 10-color palette
- AvatarCrop modal using react-easy-crop (round crop shape, 1:1 aspect, zoom slider, 256x256 JPEG output via canvas API)
- AvatarUpload component with full flow: file input -> crop modal -> presigned URL fetch -> B2 PUT upload -> API confirm -> state update
- ProfileCard showing avatar (upload-capable), display name, @username, and bio in a Card
- Profile page rebuilt: ProfileCard at top, settings list below with 6 items (Account, Appearance, Language, Notifications, Mode, Log Out)
- Working logout button that calls auth API and redirects to /login
- Inline dark mode toggle (light/dark/system) expanding within the Appearance settings row
- Bio field added to UserData interface in AuthContext for profile card display
- Build passes with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: B2 storage client, presigned URLs, and avatar processing API** - `018748e` (feat)
2. **Task 2: Avatar components, profile card, and profile page with settings** - `5d277cb` (feat)

## Files Created/Modified

- `src/lib/storage/b2.ts` - S3Client configured for B2 with graceful degradation
- `src/lib/storage/presign.ts` - Presigned URL generation (upload, download, public), key generation, MIME-to-extension mapping
- `src/app/api/upload/presigned/route.ts` - GET endpoint for presigned upload URLs with auth and validation
- `src/app/api/upload/avatar/route.ts` - POST endpoint to confirm avatar upload and update user record
- `src/components/profile/InitialsAvatar.tsx` - Circular initials avatar with color palette
- `src/components/profile/AvatarCrop.tsx` - Crop modal with react-easy-crop, canvas-based 256x256 JPEG output
- `src/components/profile/AvatarUpload.tsx` - Full upload flow component (file select, crop, presigned upload, confirm)
- `src/components/profile/ProfileCard.tsx` - User profile card with avatar, name, username, bio
- `src/app/(app)/profile/page.tsx` - Complete profile page with ProfileCard and settings list
- `src/context/AuthContext.tsx` - Added bio field to UserData interface

## Decisions Made

- **B2 client null pattern:** When B2 env vars are missing, b2Client is set to null (not instantiated with empty strings). The isB2Configured boolean gates all storage operations. This prevents cryptic AWS SDK errors and provides clear 503 responses.
- **Client-side crop (no sharp):** Avatar cropping uses canvas API on the client to produce 256x256 JPEG. Sharp is not used for avatar processing in Phase 1 -- the client crop output is trusted. Sharp remains available for future server-side image optimization.
- **Avatar key ownership validation:** The POST /api/upload/avatar endpoint verifies the key starts with `avatars/{userId}/` before accepting, preventing users from associating other users' uploads as their avatar.
- **Settings list stubs:** Account Management, Language, Notifications, and Mode settings show "Coming soon" toast. Only Logout and Appearance (dark mode) are functional in Phase 1.
- **Bio field in UserData:** Added `bio: string | null` to the AuthContext UserData interface since the /api/auth/me endpoint already returns it from the full user object, but it was missing from the client-side type.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added bio field to UserData interface**
- **Found during:** Task 2 (creating ProfileCard)
- **Issue:** ProfileCard needs to display user.bio, but the UserData interface in AuthContext did not include the bio field. The /api/auth/me endpoint already returns bio from the database, it was just missing from the TypeScript type.
- **Fix:** Added `bio: string | null` to the UserData interface in AuthContext.tsx
- **Files modified:** src/context/AuthContext.tsx
- **Commit:** 5d277cb

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minimal -- single field addition to existing interface. No scope creep.

## Issues Encountered

- Build lock file from concurrent/prior build needed manual removal before verification build could run. Not a code issue.

## User Setup Required

Backblaze B2 credentials needed for avatar upload functionality. See 01-08-USER-SETUP.md for setup instructions. The app works without B2 configured (graceful degradation with initials avatars).

## Next Phase Readiness

- B2 storage client ready for daily content media uploads (video backgrounds, audio files) in future plans
- Presigned URL pattern established and reusable for any upload type
- Profile components (InitialsAvatar, ProfileCard) ready for use in social features (post author display, comment avatars)
- Settings page structure ready to be populated with real settings sub-pages
- Avatar upload flow complete end-to-end (pending B2 credentials for actual cloud uploads)

---
*Phase: 01-foundation*
*Completed: 2026-02-12*
