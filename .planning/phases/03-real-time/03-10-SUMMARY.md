---
phase: "03-real-time"
plan: "10"
subsystem: "notification-ui"
tags: ["notifications", "ui", "dropdown", "toast", "real-time", "socket.io", "infinite-scroll"]

dependency-graph:
  requires: ["03-06 (Notification System Core)", "03-01 (Socket.IO infrastructure)"]
  provides: ["NotificationDropdown in TopBar", "NotificationToastManager", "/notifications page", "NotificationContext global state", "useNotifications hook"]
  affects: ["03-13 (integration plan)"]

tech-stack:
  added: []
  patterns: ["notification-context-global-state", "safe-badge-hook-outside-provider", "portal-rendered-toast", "slide-down-animation", "notification-type-color-coding"]

key-files:
  created:
    - src/context/NotificationContext.tsx
    - src/hooks/useNotifications.ts
    - src/components/notifications/NotificationDropdown.tsx
    - src/components/notifications/NotificationItem.tsx
    - src/components/notifications/NotificationToast.tsx
    - src/components/notifications/NotificationFilters.tsx
    - src/components/notifications/useNotificationBadge.ts
    - src/app/(app)/notifications/page.tsx
  modified:
    - src/app/(app)/layout.tsx
    - src/components/layout/TopBar.tsx
    - src/components/layout/AppShell.tsx
    - src/app/globals.css

decisions:
  - id: "notification-provider-in-layout"
    decision: "SocketProvider and NotificationProvider wrap AppShell in (app) layout, only for authenticated users"
    rationale: "Providers depend on useAuth; guest daily post view renders without providers, so TopBar badge uses safe useNotificationBadge hook"
  - id: "safe-badge-hook"
    decision: "useNotificationBadge uses raw useContext (returns null) instead of throwing useNotificationContext"
    rationale: "TopBar may render in contexts where NotificationProvider is absent (future guest scenarios); safe fallback to 0"
  - id: "portal-rendered-toast"
    decision: "NotificationToastManager uses createPortal to document.body"
    rationale: "Escapes AppShell stacking context for proper z-index layering above all content"
  - id: "notification-type-color-coding"
    decision: "Consistent color mapping: reaction=pink, comment=blue, follow=green, prayer=purple, message=teal, mention=orange"
    rationale: "Quick visual identification of notification type across toast and notification items"

metrics:
  duration: "6 min"
  completed: "2026-02-13"
---

# Phase 3 Plan 10: Notification UI Summary

Full notification UI with bell dropdown in TopBar (replaces placeholder), /notifications page with filter tabs and infinite scroll, real-time toast notifications with color-coded borders, and NotificationContext for global unread count and toast queue management.

## What Was Built

### Task 1: Notification Hook and Context

**NotificationContext (src/context/NotificationContext.tsx)**
- Global state provider for notification unread count and toast queue
- Fetches initial unread count from GET /api/notifications?count_only=true on mount
- Listens for Socket.IO "notification:new" events via notifSocket
- Increments unreadCount and adds to toast queue on new notification
- Toast queue management: one toast at a time, auto-dismiss after 3.5 seconds
- Exposes: unreadCount, currentToast, dismissToast, refreshUnreadCount, decrementUnread, clearUnreadCount
- Exported raw context for safe access via useNotificationBadge

**useNotifications (src/hooks/useNotifications.ts)**
- Full-page notification feed hook with cursor-based pagination
- State: notifications[], loading, hasMore, filter, unreadCount
- Filter support: all, follows, reactions, comments, prayer
- Real-time: prepends new notifications from Socket.IO events
- Optimistic updates for markRead, markAllRead, clearAll with rollback on failure
- Integrates with NotificationContext for global unread count management

**Provider Integration (src/app/(app)/layout.tsx)**
- SocketProvider and NotificationProvider wrap AppShell for authenticated users
- Providers only instantiated for authenticated path (not guest daily view)

### Task 2: Notification UI Components and Page

**NotificationItem (src/components/notifications/NotificationItem.tsx)**
- Avatar with type icon overlay (Heart/MessageCircle/UserPlus/HandHelping/Send/AtSign)
- Color-coded icon background per notification type
- Grouped text: "John and 3 others reacted to your post"
- Compact mode for dropdown (smaller avatar, no actions, unread dot)
- Full mode with preview text, action buttons (Follow back, Accept/Decline)
- Tap navigates to source entity (post, profile, conversation, prayer wall)
- Unread background highlight (bg-primary/5)
- Relative timestamp via date-fns formatDistanceToNow

**NotificationFilters (src/components/notifications/NotificationFilters.tsx)**
- Horizontal scrollable pill-style filter tabs
- Tabs: All | Follows | Reactions | Comments | Prayer
- Active tab: primary background, inactive: slate/glass background
- Dark mode support with white/10 glass styling

**NotificationDropdown (src/components/notifications/NotificationDropdown.tsx)**
- Replaces existing placeholder bell dropdown in TopBar
- Fetches latest 10 notifications on open
- Real-time updates while open (prepends new notifications)
- "Mark all as read" button in header
- "See all notifications" link to /notifications page
- Liquid glass styling matching existing TopBar dropdown pattern
- Empty state with BellOff icon

**NotificationToast (src/components/notifications/NotificationToast.tsx)**
- Portal-rendered via createPortal to document.body
- Fixed top-16 (below TopBar), centered, max-w-sm
- Slide-down animation via @keyframes slideDown
- Color-coded left border: reaction=pink, comment=blue, follow=green, prayer=purple, message=teal, mention=orange
- Actor avatar and preview text display
- Tappable to navigate to source entity
- Suppresses chat message toasts when viewing that conversation

**TopBar Updates (src/components/layout/TopBar.tsx)**
- Red dot unread badge on bell icon (via useNotificationBadge)
- Integrated NotificationDropdown replacing old placeholder
- Badge uses safe hook that returns 0 outside provider

**Notifications Page (src/app/(app)/notifications/page.tsx)**
- Header with "Mark all read" and "Clear all" buttons
- NotificationFilters tab bar
- Infinite scroll with IntersectionObserver and 200px rootMargin
- Empty state: BellOff icon + descriptive text
- Clear all: ConfirmDialog before deletion (danger mode)
- Follow back, accept/decline follow request action handlers

**AppShell (src/components/layout/AppShell.tsx)**
- Added NotificationToastManager for global toast rendering

**Animations (src/app/globals.css)**
- Added @keyframes slideDown for toast entrance animation

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| SocketProvider + NotificationProvider wrap AppShell in authenticated path only | Providers depend on useAuth; guests don't need socket/notifications |
| useNotificationBadge safe hook | Returns 0 outside provider instead of throwing, for future-proof guest safety |
| Portal-rendered toast | Escapes AppShell stacking context for correct z-index layering |
| Consistent type color mapping across toast and items | Quick visual identification without reading text |
| Pill-style filter tabs (not underline) | Better touch target on mobile, clearer active state |
| Compact mode for dropdown items | Fits more notifications in limited dropdown space |

## Deviations from Plan

### Auto-added Missing Items

**1. [Rule 2 - Missing Critical] useNotificationBadge safe hook**
- **Found during:** Task 2 (TopBar integration)
- **Issue:** TopBar needs unread count but useNotificationContext throws outside NotificationProvider
- **Fix:** Created useNotificationBadge.ts that safely reads context (returns 0 when null)
- **Files created:** src/components/notifications/useNotificationBadge.ts
- **Commit:** c8bb079

**2. [Rule 3 - Blocking] slideDown keyframe animation**
- **Found during:** Task 2 (NotificationToast)
- **Issue:** Toast references animate-[slideDown_0.3s_ease-out] but no keyframe existed
- **Fix:** Added @keyframes slideDown to globals.css
- **Files modified:** src/app/globals.css
- **Commit:** c8bb079

## Commits

| Hash | Description |
|------|-------------|
| b695589 | feat(03-10): notification hook, context, and provider integration |
| c8bb079 | feat(03-10): notification UI components, dropdown, toast, and full page |

## Next Phase Readiness

The notification UI is complete. Ready for:
- **03-13**: Integration plan wiring createNotification() into social actions will trigger real notifications that flow through this UI
- All notification types (reaction, comment, follow, prayer, message, mention) have UI support with icons, colors, and navigation

No blockers identified.
