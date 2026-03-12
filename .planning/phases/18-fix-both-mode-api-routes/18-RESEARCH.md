# Phase 18: Fix Both-mode API Routes - Research

**Researched:** 2026-03-12
**Domain:** API route mode resolution for Both-mode users (Sequelize queries, mode isolation logic)
**Confidence:** HIGH

## Summary

Phase 17 introduced the "Both" mode for users who want to access both Bible and Positivity content. On the frontend, the `ViewModeContext` correctly resolves `user.mode='both'` into an effective mode (`'bible'` or `'positivity'`). However, several API routes bypass this resolution and pass `user.mode` directly to database WHERE clauses. Since no content rows ever have `mode='both'` (daily content and posts are always `'bible'` or `'positivity'`), these queries return 0 rows.

There are two distinct bug categories:
1. **Daily content routes** (`/api/daily-posts` and `/api/daily-posts/[date]`): These use `mode = user.mode` in the WHERE clause. For Both users, this becomes `WHERE mode = 'both'`, which matches nothing. This is a **live bug** -- Both users hitting `/daily/[date]` directly get a 404.
2. **Feed/social mode isolation routes** (`/api/feed`, `/api/feed/fyp`, `/api/users/search`, `/api/follows/suggestions`, `/api/follows/[userId]`, `/api/workshops`): When `mode_isolation_social` is enabled, these routes filter by `user.mode`. For Both users, this filters to `mode = 'both'` which matches no posts/users. This is a **latent bug** -- `mode_isolation_social` defaults to `'false'`, so it only breaks if an admin enables it.

The fix pattern is established: `resolveContentMode()` from `@/lib/utils/constants` maps `'both'` to `'bible'` (the default). However, for social mode isolation with Both users, we need a different approach: Both users should see posts from **both** modes, meaning the mode filter should expand to `{ [Op.in]: ['bible', 'positivity'] }` rather than resolving to a single mode.

**Primary recommendation:** Apply `resolveContentMode()` to daily content routes (fixes the live 404), and for social/feed mode isolation, expand the filter to include both modes when `user.mode === 'both'` using `Op.in`.

## Standard Stack

No new libraries needed. All fixes use existing utilities and patterns.

### Core (already in project)
| Library | Purpose | Relevance |
|---------|---------|-----------|
| `resolveContentMode()` | Resolves 'both' to concrete mode ('bible' or 'positivity') | Use for daily content route fixes |
| Sequelize `Op.in` | SQL IN clause | Use for expanding mode filter in social routes |
| `@/lib/utils/constants` | Exports resolveContentMode, ContentMode types | Import target for fixes |

### No New Dependencies
This phase requires zero new npm packages. All fixes use existing project utilities.

## Architecture Patterns

### Pattern 1: Daily Content Mode Resolution (for /api/daily-posts routes)

**What:** For daily content queries, Both-mode users need their mode resolved to a concrete content mode before the DB query. The existing `resolveContentMode()` function does exactly this: `'both' -> 'bible'` (default), `'positivity' -> 'positivity'`, anything else -> `'bible'`.

**When to use:** Any API route that queries the `daily_content` table using `user.mode` in a WHERE clause.

**Why `resolveContentMode()` is correct here:** Daily content is fetched one row at a time (today's content or a specific date). The user sees either Bible or Positivity content, never both simultaneously. The ViewModeContext on the frontend determines which they see, but the API route doesn't have access to client-side localStorage. Since `resolveContentMode('both')` returns `'bible'` (the default), this matches the frontend's behavior where Both users default to Bible unless they've explicitly toggled to Positivity.

**Important caveat:** The `/api/daily-posts/[date]` route is called by `useDailyContent` hook which does NOT pass a mode query parameter -- it relies entirely on the server-side user.mode. This means the fix MUST happen server-side via `resolveContentMode()`. However, there's a subtlety: if a Both-mode user is viewing Positivity content and clicks on a past date link, the API will return Bible content (the default) because the server has no knowledge of the client's active view mode. A more complete fix would accept an optional `mode` query parameter from the frontend, but the minimum viable fix is applying `resolveContentMode()`.

**Consider also:** Adding a `?mode=` query parameter to `/api/daily-posts/[date]` and `/api/daily-posts` that the frontend can use to pass the effective view mode. This would make the API responsive to the user's active view context.

**Example fix for `/api/daily-posts/[date]/route.ts`:**
```typescript
import { resolveContentMode } from '@/lib/utils/constants';

// Before (line 38, broken):
mode = user.mode;

// After (minimal fix):
mode = resolveContentMode(user.mode);

// Better fix (accepts frontend view mode):
const url = new URL(req.url);
const modeParam = url.searchParams.get('mode');
mode = modeParam === 'positivity' ? 'positivity'
     : modeParam === 'bible' ? 'bible'
     : resolveContentMode(user.mode);
```

### Pattern 2: Social Feed Mode Expansion (for /api/feed routes)

**What:** For social feed mode isolation, Both-mode users should see posts from **all** modes (both 'bible' and 'positivity'), not be restricted to a single mode. This is different from daily content -- the feed shows multiple posts and Both users want to see everything.

**When to use:** Any API route that uses `mode_isolation_social` to filter posts or users by mode.

**Why Op.in is correct here:** Posts in the database have `mode` set to either `'bible'` or `'positivity'`. When mode isolation is enabled, Bible-only users see only Bible posts, Positivity-only users see only Positivity posts. Both-mode users should see both, which means the filter should be `WHERE mode IN ('bible', 'positivity')` -- effectively no filter at all, which is the simplest implementation (skip adding the mode condition entirely for Both users).

**Example fix for `/api/feed/route.ts`:**
```typescript
import { resolveContentMode, type ContentMode } from '@/lib/utils/constants';

if (modeIsolation === 'true') {
  const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
  if (currentUser && currentUser.mode !== 'both') {
    andConditions.push({ mode: currentUser.mode });
  }
  // Both-mode users: no mode filter needed (they see all modes)
}
```

### Pattern 3: Raw SQL Mode Handling (for suggestions route)

**What:** The `/api/follows/suggestions` route uses raw SQL with a `:userMode` replacement. For Both users, this becomes `AND u.mode = 'both'` which returns 0 users.

**When to use:** Raw SQL routes that use `currentUser.mode` as a replacement parameter.

**Example fix for `/api/follows/suggestions/route.ts`:**
```typescript
const modeFilter = modeIsolation === 'true' && currentUser.mode !== 'both'
  ? 'AND u.mode = :userMode'
  : '';
```

### Pattern 4: Cross-Mode Follow Protection (for follows/[userId] route)

**What:** The follows route prevents cross-mode follows when isolation is enabled. For Both users, `currentUser.mode !== targetUser.mode` will always be true (since target is never 'both'), wrongly blocking all follows.

**When to use:** Mode isolation checks that compare two users' modes.

**Example fix for `/api/follows/[userId]/route.ts`:**
```typescript
if (modeIsolation === 'true') {
  const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
  if (currentUser && currentUser.mode !== 'both' && currentUser.mode !== targetUser.mode) {
    return errorResponse('Cannot follow users in a different mode', 403);
  }
  // Both-mode users: can follow anyone
}
```

### Anti-Patterns to Avoid
- **Using resolveContentMode() for social feed mode isolation:** This would restrict Both users to only Bible posts. Both users should see all posts.
- **Hardcoding 'bible' as the resolved mode in social contexts:** Both users explicitly chose Both; restricting them to one mode defeats the purpose.
- **Adding mode query param without server-side fallback:** The daily-posts routes should still work without a mode param (guest users, direct navigation).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resolving 'both' to concrete content mode | Inline ternary operators scattered per route | `resolveContentMode()` from constants.ts | Already exists, tested, consistent |
| Detecting Both-mode user | Separate DB query or flag | `user.mode === 'both'` check | Direct, no extra DB call needed |
| Mode expansion for DB queries | Custom IN clause builder | Sequelize `Op.in` or skip filter | Standard Sequelize pattern, already used in codebase |

## Common Pitfalls

### Pitfall 1: Treating All Routes Identically
**What goes wrong:** Applying `resolveContentMode()` everywhere. This works for daily content (single item, concrete mode needed) but breaks for social feeds (Both users want to see all modes).
**Why it happens:** The function name suggests it's the universal solution, but it resolves to a single mode.
**How to avoid:** Daily content routes use `resolveContentMode()`. Social/feed routes use a "skip filter for Both" approach.
**Warning signs:** Both user sees only Bible posts in feed even when mode isolation is enabled.

### Pitfall 2: Forgetting the Frontend Mode Pass-Through
**What goes wrong:** `resolveContentMode('both')` always returns `'bible'`, so a Both user viewing Positivity who navigates to `/daily/[date]` gets Bible content instead of Positivity.
**Why it happens:** The server has no knowledge of the client's active view mode (stored in localStorage).
**How to avoid:** Accept an optional `mode` query parameter from the frontend, with `resolveContentMode(user.mode)` as fallback. Update the `useDailyContent` hook to pass the effective view mode.
**Warning signs:** Both user in Positivity view taps a date link and sees Bible content.

### Pitfall 3: Missing the Workshops Route
**What goes wrong:** The workshops GET route at line 81 does `where.mode = currentUser.mode` WITHOUT checking `mode_isolation_social`. For Both users, this becomes `WHERE mode = 'both'`, returning 0 workshops.
**Why it happens:** The workshops route filters by mode unconditionally (not behind mode_isolation flag), and was not listed in the audit because workshops are not yet live.
**How to avoid:** Apply `resolveContentMode()` or Both-aware filter to workshops route too.
**Warning signs:** Both user sees empty workshop list.

### Pitfall 4: Announcements Route
**What goes wrong:** The announcements route at line 24 does `user.mode || 'bible'` then filters `target_mode: { [Op.in]: ['all', userMode] }`. For Both users, this becomes `IN ('all', 'both')` which misses mode-specific announcements.
**Why it happens:** Announcements target modes include 'all', 'bible', 'positivity' but not 'both'.
**How to avoid:** For Both users, expand the filter to `{ [Op.in]: ['all', 'bible', 'positivity'] }`.
**Warning signs:** Both user misses mode-specific announcements.

### Pitfall 5: Follow Suggestions Raw SQL
**What goes wrong:** The suggestions route passes `currentUser.mode` as `:userMode` replacement. For Both users, raw SQL becomes `AND u.mode = 'both'`, returning 0 suggestions.
**Why it happens:** The raw SQL doesn't have Sequelize operator support; it uses string interpolation.
**How to avoid:** Skip the mode filter for Both users (conditionally omit the `${modeFilter}` clause).
**Warning signs:** Both user gets empty follow suggestions.

## Code Examples

### Fix 1: /api/daily-posts/route.ts (Line 27)
```typescript
// Current (broken for Both users):
mode = user.mode;

// Fixed:
import { resolveContentMode } from '@/lib/utils/constants';
// ...
mode = resolveContentMode(user.mode);
```

### Fix 2: /api/daily-posts/[date]/route.ts (Line 38)
```typescript
// Current (broken for Both users):
mode = user.mode;

// Fixed (with optional frontend mode override):
import { resolveContentMode } from '@/lib/utils/constants';
// ...
const url = new URL(req.url);
const modeParam = url.searchParams.get('mode');
if (user) {
  if (user.mode === 'both' && (modeParam === 'bible' || modeParam === 'positivity')) {
    mode = modeParam;
  } else {
    mode = resolveContentMode(user.mode);
  }
  language = user.language;
  timezone = user.timezone;
}
```

### Fix 3: /api/feed/route.ts (Lines 68-73)
```typescript
// Current (broken for Both users when mode_isolation enabled):
if (modeIsolation === 'true') {
  const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
  if (currentUser) {
    andConditions.push({ mode: currentUser.mode });
  }
}

// Fixed:
if (modeIsolation === 'true') {
  const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
  if (currentUser && currentUser.mode !== 'both') {
    andConditions.push({ mode: currentUser.mode });
  }
  // Both-mode users see all modes -- no filter added
}
```

### Fix 4: /api/feed/fyp/route.ts (Lines 89-93)
```typescript
// Current (broken):
if (modeIsolation === 'true' && currentUser) {
  andConditions.push({ mode: currentUser.mode });
}

// Fixed:
if (modeIsolation === 'true' && currentUser && currentUser.mode !== 'both') {
  andConditions.push({ mode: currentUser.mode });
}
```

### Fix 5: /api/users/search/route.ts (Lines 104-110)
```typescript
// Current (broken):
if (modeIsolation === 'true') {
  const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
  if (currentUser) {
    where.mode = currentUser.mode;
  }
}

// Fixed:
if (modeIsolation === 'true') {
  const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
  if (currentUser && currentUser.mode !== 'both') {
    where.mode = currentUser.mode;
  }
}
```

### Fix 6: /api/follows/suggestions/route.ts (Lines 33-35, 115)
```typescript
// Current (broken):
const modeFilter = modeIsolation === 'true'
  ? 'AND u.mode = :userMode'
  : '';

// Fixed:
const modeFilter = (modeIsolation === 'true' && currentUser.mode !== 'both')
  ? 'AND u.mode = :userMode'
  : '';
```

### Fix 7: /api/follows/[userId]/route.ts (Lines 52-58)
```typescript
// Current (broken):
if (currentUser && currentUser.mode !== targetUser.mode) {
  return errorResponse('Cannot follow users in a different mode', 403);
}

// Fixed:
if (currentUser && currentUser.mode !== 'both' && currentUser.mode !== targetUser.mode) {
  return errorResponse('Cannot follow users in a different mode', 403);
}
```

### Fix 8: /api/workshops/route.ts (Lines 80-83)
```typescript
// Current (broken):
const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
if (currentUser?.mode) {
  where.mode = currentUser.mode;
}

// Fixed:
import { resolveContentMode } from '@/lib/utils/constants';
// ...
const currentUser = await User.findByPk(userId, { attributes: ['mode'] });
if (currentUser?.mode) {
  if (currentUser.mode === 'both') {
    where.mode = { [Op.in]: ['bible', 'positivity'] };
  } else {
    where.mode = currentUser.mode;
  }
}
```

### Fix 9: /api/announcements/active/route.ts (Line 24, 39)
```typescript
// Current (broken):
const userMode = user.mode || 'bible';
// ...
target_mode: { [Op.in]: ['all', userMode] },

// Fixed:
const userMode = user.mode || 'bible';
const targetModes = userMode === 'both'
  ? ['all', 'bible', 'positivity']
  : ['all', userMode];
// ...
target_mode: { [Op.in]: targetModes },
```

### Frontend Fix: useDailyContent.ts (Line 80-82)
```typescript
// Current (no mode passed):
const url = date
  ? `/api/daily-posts/${date}?timezone=${tz}`
  : `/api/daily-posts?timezone=${tz}`;

// Fixed (pass effective view mode for Both users):
// This requires importing/receiving the effectiveMode from ViewModeContext
const modeParam = effectiveMode ? `&mode=${effectiveMode}` : '';
const url = date
  ? `/api/daily-posts/${date}?timezone=${tz}${modeParam}`
  : `/api/daily-posts?timezone=${tz}${modeParam}`;
```

## Affected Files - Complete Inventory

### Priority 1: Live Bugs (actively broken for Both users)
| File | Line | Bug | Fix Pattern |
|------|------|-----|-------------|
| `src/app/api/daily-posts/route.ts` | 27 | `mode = user.mode` -> WHERE mode='both' | `resolveContentMode()` + mode query param |
| `src/app/api/daily-posts/[date]/route.ts` | 38 | `mode = user.mode` -> WHERE mode='both' | `resolveContentMode()` + mode query param |
| `src/app/api/workshops/route.ts` | 82 | `where.mode = currentUser.mode` -> WHERE mode='both' | `resolveContentMode()` or Op.in |
| `src/app/api/announcements/active/route.ts` | 24 | `userMode = user.mode` -> IN ('all','both') | Expand to include both modes |

### Priority 2: Latent Bugs (only when mode_isolation_social='true')
| File | Line | Bug | Fix Pattern |
|------|------|-----|-------------|
| `src/app/api/feed/route.ts` | 71 | `{ mode: currentUser.mode }` -> WHERE mode='both' | Skip filter for Both |
| `src/app/api/feed/fyp/route.ts` | 92 | `{ mode: currentUser.mode }` -> WHERE mode='both' | Skip filter for Both |
| `src/app/api/users/search/route.ts` | 108 | `where.mode = currentUser.mode` -> WHERE mode='both' | Skip filter for Both |
| `src/app/api/follows/suggestions/route.ts` | 34 | `AND u.mode = :userMode` with 'both' | Skip modeFilter for Both |
| `src/app/api/follows/[userId]/route.ts` | 56 | `currentUser.mode !== targetUser.mode` always true | Add Both exemption |

### Priority 3: Frontend Enhancement
| File | Line | Issue | Fix Pattern |
|------|------|-------|-------------|
| `src/hooks/useDailyContent.ts` | 80-82 | No mode param sent to API | Pass effectiveMode from ViewModeContext |

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `user.mode` passed directly to WHERE | `resolveContentMode(user.mode)` for content queries | Fixes 404 for Both users |
| Mode isolation filters all modes equally | Both-mode users exempt from mode isolation filter | Both users see all social content |
| API relies solely on server-side user.mode | Frontend can pass `?mode=` for context | Both users see correct mode content based on active view |

## Open Questions

1. **Should Both-mode users bypass mode isolation entirely for social content?**
   - What we know: The simplest fix is to skip the mode filter for Both users. This means they see ALL posts regardless of mode.
   - What's unclear: Whether this is the intended UX or if Both users should see posts only from their active view mode.
   - Recommendation: Skip filter entirely. Both users chose "both" precisely because they want both modes. This is also the simplest, least error-prone approach. The frontend already shows everything in a mixed feed.

2. **Should the useDailyContent hook pass the effective view mode?**
   - What we know: Without a mode query param, the API always resolves to 'bible' for Both users. The `useDailyContent` hook currently doesn't pass mode.
   - What's unclear: The `useDailyContent` hook runs in a component that has access to ViewModeContext. Should we wire it up?
   - Recommendation: Yes, pass the effective view mode as a query parameter. This ensures that when a Both user is viewing Positivity and navigates to a specific date, they get Positivity content, not Bible content.

3. **Are there additional routes not covered by the audit?**
   - What we know: The v1.0 audit identified INT-03 and INT-04. Our research found additional affected routes (workshops, announcements, users/search, follows/suggestions, follows/[userId]).
   - What's unclear: There may be other routes that were added after the audit.
   - Recommendation: Run a final grep for `user.mode` and `currentUser.mode` in all API routes during planning to catch any stragglers.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all affected API route files
- `src/lib/utils/constants.ts` - resolveContentMode() function definition
- `src/context/ViewModeContext.tsx` - Frontend mode resolution implementation
- `.planning/v1.0-MILESTONE-AUDIT.md` - INT-03, INT-04 gap descriptions
- Phase 17 RESEARCH.md and VERIFICATION.md - Original Both-mode architecture

### Secondary (MEDIUM confidence)
- Phase 17 CONTEXT.md user decisions - Both-mode design intent

### Tertiary (LOW confidence)
- None. All findings verified by direct code reading.

## Metadata

**Confidence breakdown:**
- Daily content route fixes: HIGH - Direct code reading, clear bug, established fix pattern
- Feed mode isolation fixes: HIGH - Direct code reading, clear bug pattern across 5 routes
- Frontend mode pass-through: HIGH - Pattern clear, but represents an enhancement beyond minimum fix
- Additional routes (workshops, announcements): HIGH - Same bug pattern, discovered during research
- Both-mode social semantics (skip vs expand): MEDIUM - Design decision, not purely technical

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable codebase, no external dependencies)
