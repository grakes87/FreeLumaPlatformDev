---
phase: 18-fix-both-mode-api-routes
verified: 2026-03-12T20:41:30Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 18: Fix Both-mode API Routes — Verification Report

**Phase Goal:** Apply `resolveContentMode()` to all API routes that pass `user.mode='both'` directly to database queries, fixing 404s on `/daily/[date]` and empty feeds when mode isolation is enabled for Both-mode users.
**Verified:** 2026-03-12T20:41:30Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Both-mode user visiting `/` sees today's daily content (not a 404) | VERIFIED | `route.ts` line 33–37: `modeParam === 'bible'` guard + `resolveContentMode(user.mode)` fallback; `'both'` never reaches `WHERE mode=` |
| 2 | Both-mode user navigating to `/daily/[date]` sees content for that date (not a 404) | VERIFIED | `[date]/route.ts` lines 44–48: identical `modeParam` guard + `resolveContentMode` — same fix applied |
| 3 | Both-mode user in Positivity view navigating to `/daily/[date]` sees Positivity content (not Bible) | VERIFIED | `DailyPostCarousel.tsx` line 55–62: `SingleDayCarousel` reads `effectiveMode` from `useViewMode()` and passes it to `useDailyContent(date, effectiveMode)`; hook appends `&mode=effectiveMode` to fetch URL (line 82–85); API strictly validates `modeParam === 'positivity'` before using it |
| 4 | Guest users and single-mode users are unaffected by the daily content changes | VERIFIED | Guest path is unchanged (lines 44–49 in `route.ts`); single-mode users hit `resolveContentMode(user.mode)` which returns their exact mode; `modeParam` override only fires when the param value is exactly `'bible'` or `'positivity'` |
| 5 | Both-mode user with `mode_isolation_social` enabled sees posts from both modes in feed | VERIFIED | `feed/route.ts` line 70: `if (currentUser && currentUser.mode !== 'both')` — Both users skip the `andConditions.push({ mode: currentUser.mode })` step entirely |
| 6 | Both-mode user with `mode_isolation_social` enabled sees posts from both modes in FYP | VERIFIED | `feed/fyp/route.ts` line 91: `if (modeIsolation === 'true' && currentUser && currentUser.mode !== 'both')` |
| 7 | Both-mode user with `mode_isolation_social` enabled finds users from both modes in search | VERIFIED | `users/search/route.ts` line 107: `if (currentUser && currentUser.mode !== 'both')` before `where.mode = currentUser.mode` |
| 8 | Both-mode user with `mode_isolation_social` enabled gets follow suggestions from both modes | VERIFIED | `follows/suggestions/route.ts` line 33–35: `modeFilter` string is empty for Both users — raw SQL receives no `AND u.mode = :userMode` clause |
| 9 | Both-mode user with `mode_isolation_social` enabled can follow users of any mode | VERIFIED | `follows/[userId]/route.ts` line 56: three-part guard `currentUser.mode !== 'both' && currentUser.mode !== targetUser.mode` — Both users never hit the 403 |
| 10 | Both-mode user sees workshops from both modes (not empty list) | VERIFIED | `workshops/route.ts` lines 83–84: `if (currentUser.mode === 'both') { where.mode = { [Op.in]: ['bible', 'positivity'] }; }` |
| 11 | Both-mode user sees mode-specific announcements (bible and positivity, not just 'all') | VERIFIED | `announcements/active/route.ts` lines 26–28: `targetModes = userMode === 'both' ? ['all', 'bible', 'positivity'] : ['all', userMode]` used in `Op.in` |
| 12 | Single-mode users are completely unaffected by all changes | VERIFIED | Every change is gated on `mode === 'both'` or `mode !== 'both'`; single-mode code paths are untouched |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/daily-posts/route.ts` | Today's daily content with Both-mode resolution + optional `?mode=` query param | VERIFIED | Exists (161 lines), imports `resolveContentMode`, `modeParam` read on line 22, guard on lines 33–37, `'both'` never reaches DB |
| `src/app/api/daily-posts/[date]/route.ts` | Date-specific daily content with Both-mode resolution + optional `?mode=` query param | VERIFIED | Exists (169 lines), same pattern — `resolveContentMode` imported, `modeParam` on line 33, guard on lines 44–48 |
| `src/hooks/useDailyContent.ts` | Client hook that passes `effectiveMode` to daily-posts API for Both users | VERIFIED | Exists (253 lines), `mode?: string` param in signature (line 64), `modeParam` appended to URL (lines 82–85), `mode` in dependency array (line 149) |
| `src/components/daily/DailyPostCarousel.tsx` | `SingleDayCarousel` reads `effectiveMode` from `ViewModeContext` and passes to hook | VERIFIED | Exists (288 lines), `useViewMode` imported (line 11), `effectiveMode` destructured (line 55), passed to `useDailyContent(date, effectiveMode)` (line 62) |
| `src/app/api/feed/route.ts` | Feed with Both-mode exemption from mode isolation filter | VERIFIED | Line 70: `currentUser.mode !== 'both'` guard before mode filter push |
| `src/app/api/feed/fyp/route.ts` | FYP with Both-mode exemption from mode isolation filter | VERIFIED | Line 91: compound guard includes `currentUser.mode !== 'both'` |
| `src/app/api/users/search/route.ts` | User search with Both-mode exemption from mode isolation filter | VERIFIED | Line 107: `currentUser.mode !== 'both'` before `where.mode` assignment |
| `src/app/api/follows/suggestions/route.ts` | Follow suggestions with Both-mode exemption from mode filter in raw SQL | VERIFIED | Line 33: `modeFilter` conditionally empty for Both users; `modeFilter` interpolated into SQL at lines 58, 82, 105 |
| `src/app/api/follows/[userId]/route.ts` | Follow action with Both-mode exemption from cross-mode block | VERIFIED | Line 56: three-part guard; Both users can follow anyone |
| `src/app/api/workshops/route.ts` | Workshops list with Both-mode expansion to both modes via `Op.in` | VERIFIED | Lines 83–84: `if (currentUser.mode === 'both') { where.mode = { [Op.in]: ['bible', 'positivity'] }; }` |
| `src/app/api/announcements/active/route.ts` | Announcements with Both-mode expansion to include bible+positivity targets | VERIFIED | Lines 26–28: `targetModes` array contains `'all', 'bible', 'positivity'` for Both users; used in `Op.in` on line 43 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/hooks/useDailyContent.ts` | `/api/daily-posts` | `mode=` query parameter in fetch URL | WIRED | Line 82: `modeParam = mode ? \`&mode=${encodeURIComponent(mode)}\` : ''` appended to both URL branches |
| `src/app/api/daily-posts/route.ts` | `resolveContentMode` | import from `@/lib/utils/constants` | WIRED | Line 6: `import { LANGUAGES, resolveContentMode } from '@/lib/utils/constants'`; called at line 36 |
| `src/app/api/daily-posts/[date]/route.ts` | `resolveContentMode` | import from `@/lib/utils/constants` | WIRED | Line 6: same import; called at line 47 |
| `src/components/daily/DailyPostCarousel.tsx` → `SingleDayCarousel` | `useDailyContent` | `effectiveMode` from `ViewModeContext` | WIRED | Lines 55–62: `effectiveMode` read from `useViewMode()`, passed as second argument to `useDailyContent` |
| `src/app/api/feed/route.ts` | mode isolation check | `!== 'both'` guard before filter push | WIRED | Line 70: guard correctly positioned inside `if (modeIsolation === 'true')` block |
| `src/app/api/workshops/route.ts` | `Op.in` | Sequelize IN clause for both modes | WIRED | Lines 83–84: `{ [Op.in]: ['bible', 'positivity'] }` assigned to `where.mode` |
| `src/app/api/follows/suggestions/route.ts` | raw SQL `modeFilter` | Both-mode guard in template literal | WIRED | Line 33–35: empty string when `mode === 'both'`; interpolated at lines 58, 82, 105 covering all three UNION branches |

---

### Requirements Coverage

| Requirement | Description | Status | Notes |
|-------------|-------------|--------|-------|
| DAILY-01 | User sees curated daily post (Bible verse or positivity content) on home screen | SATISFIED | Both-mode users now see content instead of 404 via `resolveContentMode` in `/api/daily-posts`; guest and single-mode paths unchanged |
| DAILY-05 | User can view past daily posts in a history/archive view | SATISFIED | Both-mode users now see past daily content on `/daily/[date]` via `resolveContentMode` in `/api/daily-posts/[date]`; Positivity view passes `effectiveMode` through hook |
| FEED-01 | User can view chronological feed of posts from followed users | SATISFIED | Both-mode users bypass `mode_isolation_social` filter in 5 social routes; feed returns posts from all modes for Both users |

**Note:** REQUIREMENTS.md shows these IDs as `Pending` at Phase 1/2 level — that is the global status tracking original feature delivery. Phase 18 delivers the **integration fix** layer (Both-mode correctness) on top of features that were already delivered by earlier phases.

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/hooks/useDailyContent.ts` | 98 | `!videoUrl.includes('placeholder')` | INFO | Legitimate URL guard — checks if a video URL is a placeholder asset, not a stub comment. Not a concern. |

---

### Human Verification Required

The following behaviors require a logged-in Both-mode account to confirm end-to-end. Automated verification has confirmed the code paths are correctly wired.

#### 1. Both-mode daily content — home page

**Test:** Log in as a Both-mode user (mode='both'). Navigate to `/`. Observe the daily content card.
**Expected:** A real Bible verse displays (not a 404 error or spinner that never resolves).
**Why human:** Requires a live DB row for today's date and a real HTTP response to confirm no 404 slips through.

#### 2. Both-mode daily content — date navigation (Bible view)

**Test:** As a Both-mode user in Bible view, navigate to `/daily/2026-03-11` (or any past date with content).
**Expected:** Bible content for that date is shown.
**Why human:** Verifies the `resolveContentMode` default ('bible') works correctly when no `?mode=` param is sent.

#### 3. Both-mode daily content — date navigation (Positivity view)

**Test:** Switch to Positivity view (via the view toggle). Navigate to `/daily/2026-03-11`.
**Expected:** Positivity content for that date is shown (not Bible content).
**Why human:** Verifies the full chain: `ViewModeContext` → `effectiveMode` → `useDailyContent(date, effectiveMode)` → `?mode=positivity` → API returns positivity content.

#### 4. Both-mode feed with mode isolation enabled

**Test:** Enable `mode_isolation_social` in platform settings. Log in as a Both-mode user. Open the Following or FYP feed.
**Expected:** Posts from both Bible and Positivity mode users appear in the feed (not an empty list).
**Why human:** Requires mode isolation to be toggled on in the actual DB and a feed with mixed-mode followed users.

#### 5. Both-mode workshops list

**Test:** As a Both-mode user, navigate to Workshops.
**Expected:** Workshops from both Bible and Positivity categories are shown.
**Why human:** Requires live workshop records in the DB with different mode values.

---

### Gaps Summary

No gaps found. All 12 observable truths are verified across 11 modified files.

The phase goal — "Fix all API routes that break for Both-mode users" — is achieved:

- Daily content 404 bug is eliminated by `resolveContentMode()` in both daily-posts routes, with an optional `?mode=` override for frontend-driven Positivity view.
- The `useDailyContent` hook is wired to pass `effectiveMode` from `ViewModeContext`, completing the client-to-server mode handoff for `/daily/[date]` navigation.
- All 5 social/feed routes have the `!== 'both'` guard that exempts Both-mode users from `mode_isolation_social` filtering.
- Workshops and announcements expand their mode queries to `Op.in(['bible','positivity'])` and `['all','bible','positivity']` respectively for Both users.
- `resolveContentMode` itself is correctly defined: returns `'positivity'` only for `mode === 'positivity'`, everything else (including `'both'`) returns `'bible'`.
- No stub patterns, empty implementations, or TODO comments were found in any of the 11 modified files.

---

_Verified: 2026-03-12T20:41:30Z_
_Verifier: Claude (gsd-verifier)_
