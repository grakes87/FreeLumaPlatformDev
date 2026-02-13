---
phase: "03-real-time"
plan: "13"
subsystem: "integration"
tags: ["integration", "topbar", "chat-badge", "notification-settings", "messaging-access", "profile-message", "block-behavior", "notification-wiring"]

dependency-graph:
  requires: ["03-07", "03-08", "03-10"]
  provides:
    - "Chat icon in TopBar with unread badge"
    - "Messaging access and notification preference settings"
    - "Profile message button with access rules"
    - "Block behavior in chat conversations"
    - "createNotification() wired into social actions"
  affects: ["04-xx (future phases benefit from full notification pipeline)"]

tech-stack:
  added: []
  patterns:
    - "useChatUnreadBadge polling hook for safe TopBar badge"
    - "Per-category email notification toggles in settings"
    - "Messaging access grid selector (everyone/followers/mutual/nobody)"
    - "Profile message button with conversation creation"
    - "Block detection in chat with unavailable state"
    - "createNotification lazy import in API routes (non-fatal)"

key-files:
  created:
    - src/components/chat/useChatUnreadBadge.ts
  modified:
    - src/components/layout/TopBar.tsx
    - src/app/(app)/settings/page.tsx
    - src/app/api/settings/route.ts
    - src/components/profile/ProfileHeader.tsx
    - src/app/(app)/profile/[username]/page.tsx
    - src/app/api/users/[id]/profile/route.ts
    - src/app/(app)/chat/[conversationId]/page.tsx
    - src/app/api/follows/[userId]/route.ts
    - src/app/api/follows/requests/route.ts
    - src/app/api/post-reactions/route.ts
    - src/app/api/post-comments/route.ts
    - src/app/api/prayer-requests/[id]/pray/route.ts

decisions:
  - id: "chat-badge-polling"
    decision: "useChatUnreadBadge uses 60s polling of /api/chat/conversations + window focus refresh"
    rationale: "Safe outside SocketProvider; lightweight alternative to real-time subscription for badge-only use case"
  - id: "per-category-email-toggles"
    decision: "Replaced single email_notifications toggle with 4 per-category toggles (DM, follow, prayer, daily reminder)"
    rationale: "UserSetting model already has these columns from Phase 3 schema; granular control per plan requirements"
  - id: "messaging-access-grid"
    decision: "2x2 grid selector for messaging_access instead of dropdown"
    rationale: "Four options fit grid layout well; more visible than dropdown for mobile UX"
  - id: "non-fatal-notification-creation"
    decision: "All createNotification() calls wrapped in try/catch to prevent notification failures from blocking primary actions"
    rationale: "Social actions (follow, react, comment, pray) must succeed even if notification system is unavailable"

metrics:
  duration: 8 min
  completed: 2026-02-13
---

# Phase 3 Plan 13: App Integration Summary

**Chat icon in TopBar with unread badge, expanded notification preferences in settings, profile message button with messaging access rules, block behavior in chat, and createNotification() wired into follow/reaction/comment/prayer API routes**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-13T17:36:42Z
- **Completed:** 2026-02-13T17:45:23Z
- **Tasks:** 2/2
- **Files created:** 1
- **Files modified:** 11

## Task Commits

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Wire providers and update TopBar with chat icon + badges | d046e1c | Done |
| 2 | Add notification settings, profile message button, and block behavior | 65e0590 | Done |

## What Was Built

### Task 1: TopBar Chat Icon + Badge

**useChatUnreadBadge** (new hook):
- Safe polling-based hook for TopBar chat badge
- Fetches /api/chat/conversations every 60 seconds
- Checks if any conversation has unread_count > 0
- Refreshes on window focus for instant badge update
- Returns false when not authenticated (safe for guests)

**TopBar Updates:**
- Added MessageCircle icon linking to /chat
- Icon order: [Logo] ... [Chat] [Language] [Bell]
- Red dot badge appears when hasUnreadMessages is true
- Badge styling matches existing bell notification badge
- Clicking chat icon closes any open dropdowns

**Verified existing integrations from 03-10:**
- SocketProvider and NotificationProvider already wrap AppShell in layout.tsx
- NotificationToastManager already renders in AppShell
- Bell icon badge already uses useNotificationBadge
- NotificationDropdown already replaces placeholder
- ImmersiveContext already hides bottom nav for chat conversations

### Task 2: Settings, Profile, Block Behavior, Notification Wiring

**Settings Page (expanded notifications):**
- New "Messaging" section with messaging_access grid selector
  - 4 options: Everyone, Followers, Mutual Follows, Nobody
  - 2x2 grid layout with active/inactive border states
- Replaced single email toggle with 4 per-category toggles:
  - Direct Messages (email_dm_notifications)
  - Follow Requests (email_follow_notifications)
  - Prayer Notifications (email_prayer_notifications)
  - Daily Content Reminder (email_daily_reminder)
- Retained: Daily Reminder Time picker and Quiet Hours toggle with time range
- All use existing debounced auto-save pattern (500ms, PUT /api/settings)

**Settings API Updates:**
- Zod schema extended with messaging_access, email_dm_notifications, email_follow_notifications, email_prayer_notifications, email_daily_reminder
- GET response includes all new UserSetting fields
- PUT handler maps new fields to settingFields for UserSetting update
- PUT response returns updated values

**Profile Message Button:**
- Replaced disabled placeholder with functional message button
- Button state logic based on messagingAccess prop:
  - `everyone`: always enabled
  - `followers`: enabled when relationship is 'following'
  - `mutual`: enabled when relationship is 'following' (server enforces full check)
  - `nobody`: disabled with tooltip "This user doesn't accept messages"
- Tapping creates/finds conversation via POST /api/chat/conversations
- Handles 202 message request responses
- Hidden entirely when user is blocked
- Profile API updated to include messaging_access from UserSetting

**Block Behavior in Chat:**
- Chat conversation page checks for 403 response on load
- Shows "This conversation is unavailable" with back button
- Server-side block enforcement via existing conversation API

**Notification Wiring (5 API routes):**

| Route | Notification Type | Preview Text |
|-------|------------------|--------------|
| POST /api/follows/[userId] | follow or follow_request | "started following you" / "sent you a follow request" |
| PUT /api/follows/requests (accept) | follow | "accepted your follow request" |
| POST /api/post-reactions | reaction | "reacted {type} to your post" |
| POST /api/post-comments | comment | 'commented: "{preview}"' |
| POST /api/prayer-requests/[id]/pray | prayer | "prayed for your prayer request" |

All createNotification() calls:
- Use lazy imports (await import) to avoid circular dependencies
- Wrapped in try/catch to prevent blocking primary actions
- Include preview_text for toast/notification display
- Self-notification suppression handled by createNotification() itself
- Block suppression handled by createNotification() itself

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Polling-based chat badge (60s + focus) | Safe outside SocketProvider; no dependency on socket context |
| Per-category email toggles instead of single toggle | Model already has columns; granular control per requirements |
| 2x2 grid for messaging access | Better mobile UX than dropdown for 4 options |
| Non-fatal notification creation | Social actions must succeed even if notification system unavailable |
| Server-enforced mutual follow check | Client shows button based on relationship; server does full mutual check |

## Deviations from Plan

None -- plan executed exactly as written. The layout, AppShell, and TopBar bell badge were already updated by 03-10, so this plan correctly focused on adding the chat icon and expanding the notification settings.

## Verification Results

- `npx tsc --noEmit` -- zero TypeScript errors
- Chat icon visible in TopBar with MessageCircle icon and red dot badge
- Bell icon dropdown shows real notifications (from 03-10)
- SocketProvider connects on auth (from 03-10)
- Settings page has messaging access selector and per-category email toggles
- Profile shows message button with access rules (enabled/disabled based on messaging_access)
- Blocked users see "unavailable" state in chat conversations
- Follows, reactions, comments, and prayers create notifications via createNotification()
- Toast notifications appear for real-time events (from 03-10)
- Chat view is full-screen with no bottom nav (from 03-08 ImmersiveContext)

## Next Phase Readiness

Phase 3 (Real-Time) integration is complete. All isolated Phase 3 components are now connected:
- Chat accessible from TopBar icon
- Notifications flowing from social actions through to UI
- Settings control notification preferences
- Profiles enable direct messaging with access rules
- Block behavior enforced in chat

No blockers identified for future phases.

---
*Phase: 03-real-time*
*Completed: 2026-02-13*
