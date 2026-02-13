---
phase: "03-real-time"
plan: "06"
subsystem: "notification-service"
tags: ["notifications", "socket.io", "grouping", "real-time", "api-routes"]

dependency-graph:
  requires: ["03-01 (Socket.IO infrastructure)", "03-03 (Notification model and types)"]
  provides: ["createNotification() service", "getGroupedNotifications() grouping", "notification API routes", "Socket.IO notification handlers"]
  affects: ["03-07 (notification UI)", "03-08 (email scheduler)", "03-13 (integration)"]

tech-stack:
  added: []
  patterns: ["centralized-notification-creation", "raw-sql-grouped-query-with-row-number", "cursor-based-notification-pagination", "socket-io-namespace-handler-registration"]

key-files:
  created:
    - src/lib/notifications/create.ts
    - src/lib/notifications/group.ts
    - src/lib/socket/notifications.ts
    - src/app/api/notifications/route.ts
    - src/app/api/notifications/clear/route.ts
  modified:
    - src/lib/socket/index.ts

decisions:
  - id: "centralized-create-notification"
    decision: "Single createNotification() function writes to DB and pushes Socket.IO in one call"
    rationale: "Single entry point ensures all notifications go through block/self suppression checks and get real-time delivery"
  - id: "raw-sql-grouped-notifications"
    decision: "Raw SQL with LEFT JOIN subquery for grouped notification feed"
    rationale: "Sequelize ORM cannot express 'latest per group_key with actor count' efficiently; raw SQL with ROW_NUMBER for recent actors is cleaner"
  - id: "notification-count-only-mode"
    decision: "GET /api/notifications?count_only=true returns just unreadCount"
    rationale: "Lightweight badge update without fetching full notification list; reduces payload for frequent polling"

metrics:
  duration: "2 min"
  completed: "2026-02-13"
---

# Phase 3 Plan 6: Notification System Core Summary

Centralized createNotification() service with self/block suppression and Socket.IO real-time push, grouped notification feed with actor counts and cursor pagination, Socket.IO mark-read handlers, and REST API routes for notification feed/mark-read/clear.

## What Was Built

### Task 1: Notification Service and Socket.IO Handlers

**createNotification() (src/lib/notifications/create.ts)**
- Single entry point for all notification creation across the application
- Accepts: recipient_id, actor_id, type, entity_type, entity_id, preview_text, group_key
- Suppresses self-notifications (actor === recipient returns null)
- Suppresses blocked-user notifications (bidirectional check via getBlockedUserIds)
- Auto-generates group_key for groupable types: reaction -> `reaction:{entity}:{id}`, comment -> `comment:{entity}:{id}`, prayer -> `prayer:prayer_request:{id}`
- Ungrouped types (follow, follow_request, message, mention, group_invite, daily_reminder) get null group_key
- Creates Notification row in DB, fetches actor info (display_name, username, avatar_url, avatar_color)
- Pushes `notification:new` event via Socket.IO to `user:{recipient_id}` room on /notifications namespace
- Socket.IO push is non-fatal (wrapped in try/catch for test and build environments)
- Returns full NotificationPayload with actor info

**getGroupedNotifications() (src/lib/notifications/group.ts)**
- Grouped notification feed with collapsing by group_key
- Raw SQL query: LEFT JOIN subquery gets MAX(id) per group_key with COUNT(DISTINCT actor_id)
- Ungrouped notifications (NULL group_key) treated as individual entries
- Filter support: all, follows, reactions, comments, prayer
- Cursor-based pagination: base64-encoded created_at:id compound cursor
- For grouped notifications: fetches up to 3 most recent actor names using ROW_NUMBER() window function
- Returns: { notifications: GroupedNotification[], nextCursor, unreadCount }
- Always returns global unreadCount regardless of current filter

**registerNotificationHandlers() (src/lib/socket/notifications.ts)**
- Handles `notification:mark-read`: updates single notification is_read=true with recipient ownership check
- Handles `notification:mark-all-read`: updates all unread for user, returns affected count
- Handles `notifications:subscribe`: acknowledges subscription ready
- Wired into /notifications namespace connection handler in index.ts

### Task 2: Notification API Routes

**GET /api/notifications** (withAuth)
- Paginated grouped notification feed via getGroupedNotifications()
- Query params: cursor, limit (1-50, default 20), filter (all/follows/reactions/comments/prayer)
- count_only=true mode: returns just { unreadCount } for lightweight badge updates
- Returns: { notifications, nextCursor, unreadCount }

**PUT /api/notifications** (withAuth)
- Mark-read operations: `{ action: 'mark-read', notification_id }` for single, `{ action: 'mark-all-read' }` for bulk
- Returns: { success: true, unreadCount } with updated count

**DELETE /api/notifications/clear** (withAuth)
- Hard deletes all notifications for the user
- Returns: { success: true }

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Single createNotification() entry point | All notifications go through suppression checks and get real-time delivery consistently |
| Raw SQL for grouped query | Sequelize ORM cannot express latest-per-group_key efficiently; ROW_NUMBER for recent actors |
| count_only query param | Lightweight badge updates without fetching full notification list |
| Non-fatal Socket.IO push | Prevents notification creation from failing if Socket.IO not initialized |

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| 9c442e3 | feat(03-06): notification service, grouping logic, and Socket.IO handlers |
| 36bed25 | feat(03-06): notification API routes with grouped feed, mark-read, and clear |

## Next Phase Readiness

The notification system core is complete. Ready for:
- **03-07**: Notification UI components (bell dropdown, /notifications page) using GET /api/notifications
- **03-08**: Email notification scheduler calling createNotification() for email-triggered notifications
- **03-13**: Integration plan wiring createNotification() into existing social actions (follow, react, comment, pray)

No blockers identified.
