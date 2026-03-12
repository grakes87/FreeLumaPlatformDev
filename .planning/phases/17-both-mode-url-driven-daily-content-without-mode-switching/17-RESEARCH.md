# Phase 17: Both Mode - URL-driven daily content without mode switching - Research

**Researched:** 2026-03-12
**Domain:** Client-side view mode state management, Sequelize ENUM migration, notification duplication
**Confidence:** HIGH

## Summary

This phase adds a third "Both" mode to the existing Bible/Positivity mode system. Users who select Both in Settings can view both Bible and Positivity daily content via a pill toggle on each day's first slide. The entry URL determines initial mode (`/positivity` loads Positivity, root `/` loads Bible). The active view mode is stored in localStorage only -- not the database. Bible-only and Positivity-only users are completely unaffected.

The primary technical work falls into five areas: (1) Sequelize migration to add `'both'` to the User.mode ENUM, (2) a new `ViewModeContext` to provide the active view mode throughout the component tree, (3) a pill toggle component on the first carousel slide, (4) updating all `user.mode` consumers to read from the active view mode when the user is in "both" mode, and (5) doubling notification dispatches (email, push, SMS) for Both users.

**Primary recommendation:** Create a React context (`ViewModeProvider`) that resolves the "effective mode" for rendering. For `both` users it reads from localStorage; for `bible`/`positivity` users it returns `user.mode` directly. All components currently reading `user?.mode` switch to `useViewMode()` instead.

## Standard Stack

No new libraries are needed. This phase uses existing project infrastructure.

### Core (already in project)
| Library | Purpose | Relevance |
|---------|---------|-----------|
| React Context API | ViewModeProvider for active view mode | Central state management |
| localStorage | Persist active view mode for Both users | Client-side persistence across refreshes |
| Sequelize CLI (.cjs) | Migration to extend User.mode ENUM | Database schema change |
| Swiper (existing) | DailyPostCarousel horizontal slides | Pill toggle placement on first slide |

### No New Dependencies
This phase is entirely achievable with existing project dependencies. No npm installs required.

## Architecture Patterns

### Recommended Project Structure
```
src/
  context/
    ViewModeContext.tsx          # NEW: provides effectiveViewMode to component tree
  components/
    daily/
      ModePillToggle.tsx         # NEW: Bible/Positivity pill toggle for Both users
      DailyPostSlide.tsx         # MODIFIED: render ModePillToggle on first slide
      DailyPostCarousel.tsx      # MODIFIED: accept mode override from ViewModeContext
      DailyFeed.tsx              # MODIFIED: use effectiveViewMode instead of user.mode
  hooks/
    useViewMode.ts               # NEW: convenience hook wrapping ViewModeContext
    useDailyFeed.ts              # MODIFIED: read mode from useViewMode
  components/layout/
    BottomNav.tsx                 # MODIFIED: read mode from useViewMode
    TopBar.tsx                    # MODIFIED: read mode from useViewMode
    CreatePicker.tsx              # MODIFIED: read mode from useViewMode
  lib/db/migrations/
    125-add-both-to-user-mode-enum.cjs  # NEW: ALTER TABLE migration
  lib/db/models/
    User.ts                      # MODIFIED: add 'both' to mode type union
  app/(app)/
    settings/page.tsx            # MODIFIED: add Both option to mode selector
    layout.tsx                   # MODIFIED: wrap with ViewModeProvider
    positivity/page.tsx          # MODIFIED: set initial view mode from URL
    page.tsx                     # MODIFIED: set initial view mode from URL
  lib/email/queue.ts             # MODIFIED: send two reminders for Both users
  lib/sms/queue.ts               # MODIFIED: dispatch two SMS for Both users
```

### Pattern 1: ViewModeContext (Central View Mode Resolution)
**What:** A React context that resolves the "effective rendering mode" for the entire component tree. For `both` users, it reads from localStorage and exposes a setter. For `bible`/`positivity` users, it returns `user.mode` directly.
**When to use:** Everywhere the app needs to know which mode to render (daily content, nav tabs, prayer wall visibility, etc.)
**Example:**
```typescript
// src/context/ViewModeContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

type EffectiveMode = 'bible' | 'positivity';

interface ViewModeContextValue {
  /** The mode to use for rendering: always 'bible' or 'positivity', never 'both' */
  effectiveMode: EffectiveMode;
  /** Whether the user is a Both-mode user (controls toggle visibility) */
  isBothMode: boolean;
  /** Switch the active view mode (only works for Both users) */
  setViewMode: (mode: EffectiveMode) => void;
}

const STORAGE_KEY = 'fl_view_mode';

const ViewModeContext = createContext<ViewModeContextValue>({
  effectiveMode: 'bible',
  isBothMode: false,
  setViewMode: () => {},
});

export function ViewModeProvider({
  children,
  initialMode
}: {
  children: ReactNode;
  initialMode?: EffectiveMode;
}) {
  const { user } = useAuth();
  const isBothMode = user?.mode === 'both';

  const [viewMode, setViewModeState] = useState<EffectiveMode>(() => {
    // Priority: initialMode (from URL) > localStorage > 'bible'
    if (initialMode) return initialMode;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'bible' || stored === 'positivity') return stored;
    }
    return 'bible';
  });

  // When initialMode changes (e.g., URL navigation), update
  useEffect(() => {
    if (initialMode && isBothMode) {
      setViewModeState(initialMode);
    }
  }, [initialMode, isBothMode]);

  const setViewMode = useCallback((mode: EffectiveMode) => {
    if (!isBothMode) return;
    setViewModeState(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }, [isBothMode]);

  // Resolve: for non-both users, always return user.mode
  const effectiveMode: EffectiveMode = isBothMode
    ? viewMode
    : (user?.mode === 'positivity' ? 'positivity' : 'bible');

  return (
    <ViewModeContext.Provider value={{ effectiveMode, isBothMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
```

### Pattern 2: Pill Toggle on First Slide
**What:** A compact pill-shaped toggle (Bible | Positivity) rendered on the first slide of each day's carousel, visible only to Both-mode users.
**When to use:** Inside `DailyPostSlide.tsx`, positioned at the top of the content overlay.
**Example:**
```typescript
// src/components/daily/ModePillToggle.tsx
'use client';

import { cn } from '@/lib/utils/cn';
import { useViewMode } from '@/context/ViewModeContext';

export function ModePillToggle() {
  const { effectiveMode, isBothMode, setViewMode } = useViewMode();

  if (!isBothMode) return null;

  return (
    <div className="flex rounded-full border border-white/25 bg-white/15 backdrop-blur-md overflow-hidden">
      <button
        type="button"
        onClick={() => setViewMode('bible')}
        className={cn(
          'px-4 py-1.5 text-xs font-semibold transition-colors',
          effectiveMode === 'bible'
            ? 'bg-white text-black'
            : 'text-white/80 hover:text-white'
        )}
      >
        Bible
      </button>
      <button
        type="button"
        onClick={() => setViewMode('positivity')}
        className={cn(
          'px-4 py-1.5 text-xs font-semibold transition-colors',
          effectiveMode === 'positivity'
            ? 'bg-white text-black'
            : 'text-white/80 hover:text-white'
        )}
      >
        Positivity
      </button>
    </div>
  );
}
```

### Pattern 3: MySQL ENUM Extension Migration
**What:** ALTER TABLE to add `'both'` to the `users.mode` ENUM column.
**When to use:** Single Sequelize CLI migration (.cjs format).
**Example:**
```javascript
// src/lib/db/migrations/125-add-both-to-user-mode-enum.cjs
'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE users
      MODIFY COLUMN mode ENUM('bible', 'positivity', 'both')
      NOT NULL DEFAULT 'bible'
    `);
  },

  async down(queryInterface) {
    // First move any 'both' users back to 'bible'
    await queryInterface.sequelize.query(`
      UPDATE users SET mode = 'bible' WHERE mode = 'both'
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE users
      MODIFY COLUMN mode ENUM('bible', 'positivity')
      NOT NULL DEFAULT 'bible'
    `);
  },
};
```

### Pattern 4: Dual Notification Dispatch for Both Users
**What:** In `processDailyReminders()`, Both-mode users receive two reminder emails (one Bible, one Positivity) and two SMS messages, each deep-linking to the appropriate mode.
**When to use:** Modify the existing daily reminder loop in `src/lib/email/queue.ts`.
**Example approach:**
```typescript
// In processDailyReminders(), after matching user:
const modesToNotify: Array<'bible' | 'positivity'> =
  user.mode === 'both' ? ['bible', 'positivity'] : [user.mode];

for (const notifyMode of modesToNotify) {
  const content = contentMap[notifyMode]?.[userLang] || contentMap[notifyMode]?.['en'];
  if (!content) continue;

  const dailyUrl = notifyMode === 'positivity'
    ? `${APP_URL}/positivity`
    : `${APP_URL}/`;

  // Send email with mode-specific content and deep link...
  // Send SMS with mode-specific deep link...
}
```

### Anti-Patterns to Avoid
- **Storing active view mode in the database:** The CONTEXT.md explicitly says active view mode is localStorage only. The DB column stays `'both'` -- do NOT add a `current_view_mode` column.
- **Modifying URL on toggle:** The URL stays static when toggling modes. Do NOT use `router.push()` or `window.history.pushState()` on pill toggle.
- **Creating a separate Both landing page:** Both users use the same `/` and `/positivity` routes. The ViewModeContext handles the rendering difference.
- **Breaking single-mode users:** All changes must be additive. Bible-only and Positivity-only users must see zero behavioral changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active mode state management | Custom event bus or prop drilling | React Context (ViewModeContext) | Consistent with AuthContext, DailyTranslationContext patterns in codebase |
| localStorage persistence | Raw localStorage calls scattered | Centralized in ViewModeProvider | Single source of truth, easier to manage edge cases |
| MySQL ENUM change | Sequelize changeColumn helper | Raw SQL via `queryInterface.sequelize.query()` | Sequelize's changeColumn with ENUM is unreliable on MySQL; raw ALTER TABLE is the established pattern (see migration 118) |
| Mode-aware pill toggle | Building from scratch | Tailwind pill toggle with backdrop-blur | Matches existing TopBar button styles (translation selector, verse mode toggle) |

## Common Pitfalls

### Pitfall 1: Forgetting to Update All user.mode Consumers
**What goes wrong:** Some components still read `user?.mode` directly instead of `useViewMode().effectiveMode`, causing inconsistent behavior for Both users.
**Why it happens:** There are 30+ files that reference `user.mode` or `user?.mode`. Easy to miss some.
**How to avoid:** Systematically audit every file listed in the grep results. Key files to update:
- `BottomNav.tsx` (line 59: `const mode = user?.mode ?? 'bible'`)
- `DailyFeed.tsx` (line 35: `const effectiveMode = user?.mode || mode || 'bible'`)
- `TopBar.tsx` (line 51: `const isBibleMode = user?.mode === 'bible'`)
- `CreatePicker.tsx` (line 22: `workshopLabel(user?.mode)`)
- `TutorialProvider.tsx` (line 57: `bibleOnly` filter)
- `useDailyFeed.ts` (line 42: `const effectiveMode = mode || 'bible'`)
- Settings page: (the mode section iterates `MODES` array)
**Warning signs:** Prayer wall tab showing for Both user in Positivity view, or Bible translations appearing for Positivity content.

### Pitfall 2: Settings Page Mode Selector Type Mismatch
**What goes wrong:** The Settings page's `showModeConfirm` state is typed as `'bible' | 'positivity' | null`. Adding `'both'` requires updating the type, the `MODE_CONFIG` object, the confirmation dialog wording, and the MODES constant.
**Why it happens:** Multiple places in settings need coordinated type updates.
**How to avoid:** Update in order: (1) constants.ts `MODES` array, (2) Settings page `MODE_CONFIG`, (3) Settings page state types, (4) confirmation dialog copy. The "Both" option should NOT show a confirmation dialog since it's additive -- it doesn't remove access to current content.

### Pitfall 3: Notification Dedup for Both Users
**What goes wrong:** Both users might get deduplicated out of their second daily reminder because the dedup check (`sentToday` Set) marks them as "already sent" after the first reminder email.
**Why it happens:** Current dedup uses `recipient_id` + `email_type` (daily_reminder). Two reminders for the same user would collide.
**How to avoid:** Either: (a) track mode in the dedup check (e.g., differentiate by subject or a mode field), or (b) process both modes in a single loop iteration so the dedup set only prevents re-processing on subsequent cron runs, not within the same run. Approach (b) is simpler: loop inside the user iteration before adding to `sentToday`.

### Pitfall 4: AuthContext UserData Type Doesn't Include 'both'
**What goes wrong:** `AuthContext.tsx` defines `UserData.mode` as `'bible' | 'positivity'`. The /api/auth/me endpoint returns `user.mode` which could now be `'both'`. TypeScript will flag this as invalid.
**Why it happens:** The type was defined before 'both' existed.
**How to avoid:** Update `UserData.mode` type in `AuthContext.tsx` to `'bible' | 'positivity' | 'both'`. Also update `UserAttributes.mode` in `User.ts` model.

### Pitfall 5: Feed API Mode Parameter
**What goes wrong:** The `/api/daily-posts/feed` endpoint accepts `mode` as a query param and filters `WHERE mode = ?`. If `'both'` is passed, no content will match since daily content rows are always `'bible'` or `'positivity'`.
**Why it happens:** Both mode is a user preference, not a content type. Daily content entries remain Bible or Positivity.
**How to avoid:** The client-side `useDailyFeed` hook must pass the resolved `effectiveMode` ('bible' or 'positivity'), never 'both'. The ViewModeContext handles this resolution.

### Pitfall 6: Carousel Data Refetch on Mode Toggle
**What goes wrong:** User toggles from Bible to Positivity but sees stale Bible content because the feed data wasn't refetched.
**Why it happens:** `useDailyFeed` memoizes its `fetchPage` callback based on `effectiveMode`. Changing mode triggers a new callback, but the `useEffect` dependency must be wired correctly.
**How to avoid:** The `useDailyFeed` hook already includes `effectiveMode` in its `fetchPage` dependency array (line 113). When `effectiveMode` changes, `fetchPage` changes, triggering the effect on line 117-123 to refetch. Verify this works by testing the toggle and confirming fresh data loads.

### Pitfall 7: Guest Daily Route Handling
**What goes wrong:** The `GuestDailyWrapper` in `layout.tsx` determines mode from pathname (`pathname === '/positivity' ? 'positivity' : 'bible'`). Both mode is authenticated-only, so guests are unaffected, but the ViewModeProvider must not wrap guest views or must gracefully handle `user === null`.
**Why it happens:** ViewModeProvider depends on `useAuth()` which returns null for guests.
**How to avoid:** ViewModeProvider should default to `isBothMode: false` when `user` is null. The current pattern (using `user?.mode === 'both'`) naturally handles this since null !== 'both'.

## Code Examples

### Existing: How BottomNav Currently Reads Mode (line 59)
```typescript
// Current pattern -- MUST change
const mode = user?.mode ?? 'bible';
```

### After: BottomNav Using ViewModeContext
```typescript
// New pattern
import { useViewMode } from '@/context/ViewModeContext';

// Inside component:
const { effectiveMode } = useViewMode();
const wl = workshopLabel(effectiveMode);
// ...
const filterTabs = (tabs: NavTab[]) =>
  tabs.filter((tab) => !tab.bibleOnly || effectiveMode === 'bible');
```

### Existing: How DailyFeed Passes Mode to useDailyFeed (line 29-32)
```typescript
// Current pattern
const { days, loading, ... } = useDailyFeed(
  user?.mode || mode,
  user?.language,
);
```

### After: DailyFeed Using ViewModeContext
```typescript
// New pattern
const { effectiveMode } = useViewMode();
const { days, loading, ... } = useDailyFeed(
  effectiveMode,
  user?.language,
);
```

### Existing: How Settings Mode Selector Works (settings page line 371-392)
```typescript
// Current: iterates MODES = ['bible', 'positivity']
{MODES.map((m) => {
  const config = MODE_CONFIG[m];
  // ...
})}
```

### After: Settings With Three Options
```typescript
// Update constants.ts
export const MODES = ['bible', 'positivity', 'both'] as const;
export type Mode = typeof MODES[number];

// Update settings page MODE_CONFIG
const MODE_CONFIG = {
  bible: { label: 'Bible', description: 'Daily verses and faith content', icon: BookOpen },
  positivity: { label: 'Positivity', description: 'Daily quotes and inspiration', icon: Sparkles },
  both: { label: 'Both', description: 'Access Bible and Positivity content', icon: Layers },
} as const;

// No confirmation dialog for switching TO 'both' (additive, non-destructive)
```

### Existing: How Daily Reminders Are Sent (queue.ts line 540-545)
```typescript
// Current: sends one email per user
const content = contentMap[user.mode]?.[userLang] || contentMap[user.mode]?.['en'];
```

### After: Dual Dispatch for Both Users
```typescript
// New: sends two emails for Both users
const modesToNotify: Array<'bible' | 'positivity'> =
  user.mode === 'both' ? ['bible', 'positivity'] : [user.mode];

for (const notifyMode of modesToNotify) {
  const content = contentMap[notifyMode]?.[userLang] || contentMap[notifyMode]?.['en'];
  if (!content) continue;

  const dailyUrl = notifyMode === 'positivity'
    ? `${APP_URL}/positivity`
    : `${APP_URL}/`;

  const trackingId = generateTrackingId();
  const unsubscribeUrl = await generateUnsubscribeUrl(user.id, 'daily_reminder');

  const verseText = content.content_text.slice(0, 200) +
    (content.content_text.length > 200 ? '...' : '');
  const verseReference = content.verse_reference || content.title;

  const { html, subject, headers } = dailyReminderEmail({
    recipientName: user.display_name,
    verseText,
    verseReference,
    dailyUrl,
    trackingId,
    unsubscribeUrl,
  });

  await sendNotificationEmail({
    userId: user.id,
    userEmail: user.email,
    emailType: 'daily_reminder',
    subject,
    html,
    headers,
    trackingId,
    quietStart: settings.quiet_hours_start,
    quietEnd: settings.quiet_hours_end,
    reminderTimezone: settings.reminder_timezone,
  });

  // SMS for this mode
  try {
    const { dispatchSMSNotification } = await import('@/lib/sms/queue');
    await dispatchSMSNotification(user.id, 'daily_reminder', 'daily_content', 0, null);
  } catch {}
}
```

### ViewModeProvider Placement in App Layout
```typescript
// src/app/(app)/layout.tsx -- add ViewModeProvider inside AuthProvider
// The initialMode comes from pathname analysis
import { ViewModeProvider } from '@/context/ViewModeContext';

// Inside AuthenticatedLayout, wrap AppShell:
<ViewModeProvider initialMode={pathname === '/positivity' ? 'positivity' : 'bible'}>
  <AppShell>{children}</AppShell>
</ViewModeProvider>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| User.mode: 'bible' or 'positivity' | User.mode: 'bible', 'positivity', or 'both' | This phase | Additive ENUM change, backward compatible |
| Mode is always from `user.mode` | Mode resolved via ViewModeContext | This phase | Both users get client-side mode switching without DB writes |
| One daily reminder per user | Both users get two reminders | This phase | Doubles email/SMS volume for Both users only |

## Key Files Requiring Changes

Comprehensive list of files that read `user.mode` or `user?.mode` and need updating:

### Must Update (read mode for rendering/behavior)
| File | Current Pattern | Change Needed |
|------|----------------|---------------|
| `BottomNav.tsx` | `user?.mode ?? 'bible'` | Use `useViewMode().effectiveMode` |
| `DailyFeed.tsx` | `user?.mode \|\| mode \|\| 'bible'` | Use `useViewMode().effectiveMode` |
| `TopBar.tsx` | `user?.mode === 'bible'` | Use `useViewMode().effectiveMode === 'bible'` |
| `CreatePicker.tsx` | `workshopLabel(user?.mode)` | Use `workshopLabel(effectiveMode)` |
| `TutorialProvider.tsx` | `bibleOnly` filter against `user.mode` | Use `effectiveMode` |
| `useDailyFeed.ts` | `mode \|\| 'bible'` | Already receives mode prop; caller must pass `effectiveMode` |
| `DailyPostSlide.tsx` | Content-driven (reads `content.mode`) | Add `ModePillToggle` component |
| `settings/page.tsx` | `MODES` array, `MODE_CONFIG`, types | Add 'both' option |

### Must Update (type definitions)
| File | Current Type | New Type |
|------|-------------|----------|
| `AuthContext.tsx` | `mode: 'bible' \| 'positivity'` | `mode: 'bible' \| 'positivity' \| 'both'` |
| `User.ts` (model) | `mode: 'bible' \| 'positivity'` | `mode: 'bible' \| 'positivity' \| 'both'` |
| `constants.ts` | `MODES = ['bible', 'positivity']` | `MODES = ['bible', 'positivity', 'both']` |
| `settings/page.tsx` | `Settings.mode: 'bible' \| 'positivity'` | `Settings.mode: 'bible' \| 'positivity' \| 'both'` |

### Must Update (notification dispatching)
| File | Current Behavior | Change Needed |
|------|-----------------|---------------|
| `lib/email/queue.ts` | One daily reminder per user | Two for Both users, different deep links |
| `lib/sms/queue.ts` | One daily SMS per user | Two for Both users (called from email queue loop) |

### API Routes (may need minor updates)
| File | Concern |
|------|---------|
| `api/settings/route.ts` | Accept `'both'` in mode validation (Zod schema line 15) |
| `api/daily-posts/route.ts` | For authenticated Both users, must resolve to effective mode, not pass 'both' to DB query |
| `api/daily-posts/feed/route.ts` | Client must pass resolved mode ('bible' or 'positivity'), not 'both' |

### No Changes Needed
| File | Reason |
|------|--------|
| `api/daily-posts/[date]/route.ts` | Mode comes from user.mode for single-day; client should override |
| `ModeSelector.tsx` (onboarding) | Both not available during signup per CONTEXT.md |
| `api/auth/me/route.ts` | Returns full user object; 'both' is valid |

## Edge Cases (from CONTEXT.md)

| Edge Case | Handling Strategy |
|-----------|------------------|
| Cross-mode deep link | If Both user in Positivity taps Bible daily link: update localStorage + ViewModeContext to 'bible', toggle updates |
| Missing content for a day | Skip that day in feed (existing behavior -- feed API already returns only published content) |
| No content at all for a mode | Auto-switch back to Bible with toast: "No positivity content available. Showing Bible content." |
| Single-mode user hits /positivity URL | Ignored -- always see their own mode's content (ViewModeContext returns user.mode for non-both users) |
| Scroll position on mode toggle | Reset to top (today) via `getScrollContainer()?.scrollTo(0, 0)` |
| localStorage empty on first visit | Default to 'bible' per CONTEXT.md |
| Date deep links (`/daily/[date]`) | Use current session mode from ViewModeContext |

## Open Questions

1. **Notification dedup for Both users**
   - What we know: Current dedup uses `sentToday` Set keyed by `recipient_id`. Two reminders for one user will collide.
   - What's unclear: Whether to add mode awareness to dedup or handle it within the loop.
   - Recommendation: Process both modes within the same user iteration, then add to `sentToday`. The dedup set prevents the cron from re-processing on subsequent runs, but within a single run, both emails send.

2. **Push notifications for Both users**
   - What we know: Daily reminders currently trigger email + SMS. Push notifications are sent via Socket.IO (in-app) not web push for daily reminders.
   - What's unclear: Whether "two push notifications" means two in-app notifications or web push. The CONTEXT.md says "two separate push notifications."
   - Recommendation: If push notifications exist for daily reminders, send two. If only email + SMS, add two of each. Verify the current push notification flow for daily reminders.

3. **Signup Both mode mention**
   - What we know: CONTEXT.md says "Brief mention during signup that Both mode is available in Settings."
   - What's unclear: Exact placement and wording.
   - Recommendation: Add a small text note below the Mode selector on the onboarding page: "Want both? You can access Bible and Positivity content together in Settings."

## Sources

### Primary (HIGH confidence)
- Codebase analysis: Direct reading of all referenced source files
- `17-CONTEXT.md`: User decisions from discussion phase
- Existing migration pattern: `118-extend-church-activity-types.cjs` (raw SQL ENUM extension)
- Existing context pattern: `AuthContext.tsx`, `DailyTranslationContext.tsx`

### Secondary (MEDIUM confidence)
- MySQL ENUM ALTER TABLE behavior: Adding values is a metadata-only change in MySQL 8.0 -- instant, no table rebuild

### Tertiary (LOW confidence)
- Push notification handling for daily reminders: Could not locate web push daily reminder dispatch in codebase. May be email/SMS only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, all patterns exist in codebase
- Architecture (ViewModeContext): HIGH - Follows established AuthContext/DailyTranslationContext patterns
- Migration: HIGH - Exact pattern exists in migration 118
- Notification changes: MEDIUM - Clear approach but dedup needs careful implementation
- Pill toggle UI: HIGH - Follows existing TopBar button styling patterns
- File change audit: HIGH - Comprehensive grep of all user.mode references

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable project, no external dependency changes)
