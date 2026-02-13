---
phase: 03-real-time
plan: 07
subsystem: chat-ui
tags: [chat, conversations, presence, socket-io, real-time, user-picker, message-requests]
dependency-graph:
  requires: [03-04, 03-05]
  provides: [chat-inbox-page, conversation-list-ui, presence-hook, user-picker, message-request-ui]
  affects: [03-08, 03-09, 03-13]
tech-stack:
  added: []
  patterns: [useConversations-socket-listeners, usePresence-bulk-query, createPortal-user-picker, debounced-search, relative-time-formatting]
key-files:
  created:
    - src/hooks/useConversations.ts
    - src/hooks/usePresence.ts
    - src/app/(app)/chat/page.tsx
    - src/components/chat/ConversationList.tsx
    - src/components/chat/ConversationItem.tsx
    - src/components/chat/UserPicker.tsx
    - src/components/chat/OnlineStatusDot.tsx
    - src/components/chat/MessageRequestBanner.tsx
  modified: []
decisions:
  - id: "relative-time-custom"
    decision: "Custom formatRelativeTime for chat timestamps (now, 2m, 1h, Yesterday, 3d) with date-fns fallback"
    rationale: "Short format matches Instagram DM style; avoids long 'about X ago' strings in tight layout"
  - id: "presence-bulk-query-pattern"
    decision: "usePresence accepts userIds array and emits presence:query for initial bulk status"
    rationale: "Avoids N individual queries; gets all online statuses in one round trip on page load"
  - id: "user-picker-create-portal"
    decision: "UserPicker uses createPortal to document.body for full-screen overlay"
    rationale: "Consistent with existing Modal/Toast pattern; escapes AppShell stacking context"
metrics:
  duration: 3 min
  completed: 2026-02-13
---

# Phase 3 Plan 7: Chat Conversation List Page Summary

**Chat inbox page at /chat with conversation list, debounced search, online presence dots, message request banner with accept/decline, and full-screen user picker for composing new conversations**

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Create hooks for conversations and presence | 4253dea | Done |
| 2 | Create chat page and conversation list components | 9a60ac5 | Done |

## What Was Built

### Hooks (2 files)

**useConversations** - Full conversation list state management:
- Fetches from GET /api/chat/conversations with debounced search (300ms)
- State: conversations[], messageRequests[], loading, error, search
- Socket.IO listeners: message:new (updates preview + sort + unread), conversation:new, conversation:deleted, message:unsent
- Proper cleanup of socket listeners on unmount (Pitfall 2 prevention)
- AbortController for in-flight request cancellation

**usePresence** - Online/offline presence tracking:
- Maintains Set<number> of online user IDs
- Bulk presence query via Socket.IO callback on mount (presence:query with userIds[])
- Listens for presence:online and presence:offline events
- Exposes isOnline(userId) boolean helper

### Components (5 files)

**OnlineStatusDot** - Green dot presence indicator (8px sm / 12px md) with white ring, absolutely positioned on avatar parent

**ConversationItem** - Conversation row with:
- Avatar (image or InitialsAvatar) with OnlineStatusDot for direct convos
- Display name (other user for direct, group name for group)
- Last message preview (truncated to 40 chars, "You: ..." or sender prefix for groups)
- Custom relative timestamp (now/2m/1h/Yesterday/3d/date-fns fallback)
- Blue unread count badge (up to "99+")
- Tap navigates to /chat/[conversationId]

**MessageRequestBanner** - Expandable banner at top of list:
- "Message Requests (N)" with chevron toggle
- Per-request: avatar, name, @username, message preview
- Accept/Decline buttons with loading states
- Calls POST /api/chat/requests with action accept/decline
- Removes from local state on success

**UserPicker** - Full-screen overlay via createPortal:
- Header with close (X) button and "New Message" title
- "To:" search bar with debounced user search (300ms, min 2 chars)
- Results from GET /api/users/search with avatar, name, username, follow status
- Tap creates conversation via POST /api/chat/conversations, navigates to it
- Handles 202 message request responses gracefully
- Loading overlay while creating conversation

**ConversationList** - Main inbox component combining all above:
- "Messages" header + compose button (pencil icon)
- Search bar with clear button
- MessageRequestBanner (conditionally shown)
- Scrollable ConversationItem list
- Empty state with chat icon illustration
- Error state with retry button

### Chat Page (1 file)

**/chat page** - Renders ConversationList within max-w-lg container:
- Uses useConversations for data + search + real-time updates
- Collects participant IDs for usePresence bulk query
- Passes isOnline function to ConversationList for per-item presence

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Custom formatRelativeTime (now/2m/1h/Yesterday/3d) | Instagram DM-style short format for tight layout |
| usePresence bulk query via callback | Single round-trip for all online statuses on page load |
| UserPicker createPortal to body | Consistent with Modal/Toast pattern; escapes stacking context |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` -- zero TypeScript errors (both tasks)
- Chat page exists at /chat route within (app) layout
- ConversationList renders search, compose button, request banner, and conversation items
- UserPicker opens as full-screen overlay with user search
- OnlineStatusDot shows green dot for online users
- Socket.IO listeners properly cleaned up on unmount

## Next Phase Readiness

Chat inbox UI complete. Ready for:
- **03-08**: Chat message view (conversations link to /chat/[conversationId])
- **03-09**: Voice messages (will appear in conversation items with "Voice message" preview)
- **03-13**: TopBar chat icon wiring (navigates to /chat page created here)

---
*Phase: 03-real-time*
*Completed: 2026-02-13*
