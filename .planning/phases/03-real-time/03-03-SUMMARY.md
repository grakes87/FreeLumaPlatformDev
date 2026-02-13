---
phase: "03-real-time"
plan: "03"
subsystem: "notifications-data-layer"
tags: ["notifications", "email-logs", "user-settings", "sequelize", "database"]

dependency-graph:
  requires: ["01-04"]  # UserSetting model from Phase 1
  provides: ["notification-models", "email-log-model", "notification-types", "messaging-preferences"]
  affects: ["03-04", "03-05", "03-06", "03-07"]  # Notification creation, email scheduler, notification UI, settings UI

tech-stack:
  added: []
  patterns: ["notification-grouping-via-group_key", "email-delivery-status-tracking", "per-category-email-toggles"]

file-tracking:
  key-files:
    created:
      - src/lib/db/migrations/040-create-notifications.cjs
      - src/lib/db/migrations/041-create-email-logs.cjs
      - src/lib/db/migrations/042-add-messaging-notification-prefs-to-user-settings.cjs
      - src/lib/db/models/Notification.ts
      - src/lib/db/models/EmailLog.ts
      - src/lib/notifications/types.ts
    modified:
      - src/lib/db/models/UserSetting.ts
      - src/lib/db/models/index.ts

decisions:
  - id: "notification-group-key"
    decision: "group_key column encodes type:entity_type:entity_id for collapsible notifications"
    rationale: "Enables 'John and 3 others reacted to your post' without complex joins"
  - id: "email-log-tracking"
    decision: "EmailLog tracks queued/sent/bounced/opened status with tracking_id UUID for pixel tracking"
    rationale: "Enables admin dashboard email delivery metrics and open rate tracking"
  - id: "messaging-access-default-mutual"
    decision: "messaging_access defaults to 'mutual' (only mutual followers can DM)"
    rationale: "Privacy-first default prevents unsolicited messages while allowing engaged users to chat"
  - id: "reminder-timezone-column"
    decision: "reminder_timezone IANA string for timezone-aware daily reminders"
    rationale: "Enables sending daily content reminders at the user's local time"

metrics:
  duration: "3 min"
  completed: "2026-02-13"
---

# Phase 3 Plan 3: Notification & Email Data Layer Summary

Notification and email log database tables, Sequelize models, notification type definitions, and UserSetting extensions for messaging access control and per-category email notification preferences.

## What Was Done

### Task 1: Database Migrations (040, 041, 042)
- **notifications** table: recipient_id/actor_id FKs to users, type ENUM (9 values), entity_type ENUM (7 values), entity_id, preview_text, group_key for collapsing, is_read flag. Indexes on (recipient_id, is_read, created_at), (group_key, recipient_id), and (created_at) for cleanup.
- **email_logs** table: recipient_id FK, email_type ENUM (dm_batch, follow_request, prayer_response, daily_reminder), subject, status ENUM (queued/sent/bounced/opened), sent_at, opened_at, tracking_id. Indexes on (status, created_at) and (tracking_id).
- **user_settings** extensions: messaging_access ENUM (everyone/followers/mutual/nobody, default mutual), email_dm_notifications, email_follow_notifications, email_prayer_notifications, email_daily_reminder (all boolean, default true), reminder_timezone (VARCHAR 50, nullable).

### Task 2: Models, Types, Associations
- **NotificationType** enum: follow, follow_request, reaction, comment, prayer, message, mention, group_invite, daily_reminder (9 categories)
- **NotificationEntityType** enum: post, comment, follow, prayer_request, message, conversation, daily_content (7 types)
- **NotificationPayload** interface with optional actor info for real-time push
- **Notification** Sequelize model with full Attributes/CreationAttributes interfaces
- **EmailLog** Sequelize model with full Attributes/CreationAttributes interfaces
- **UserSetting** extended with 6 new fields (messaging_access, 4 email toggles, reminder_timezone)
- Associations in index.ts: User->Notification (recipient + actor), User->EmailLog (recipient)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| group_key encodes type:entity_type:entity_id | Enables notification collapsing without complex queries |
| EmailLog status tracking with pixel UUID | Admin dashboard delivery metrics with approximate open tracking |
| messaging_access defaults to 'mutual' | Privacy-first; only mutual followers can DM by default |
| reminder_timezone as IANA string | Standard timezone format for node-cron daily reminder scheduling |
| Separate email toggle per category | Users can independently control DM, follow, prayer, and daily reminder emails |

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| 147189c | feat(03-03): create notification/email-log tables and extend user_settings |
| db21757 | feat(03-03): add Notification/EmailLog models, types, and UserSetting extensions |

## Next Phase Readiness

The notification data layer is complete. Ready for:
- **03-04**: Notification creation service (`createNotification()` using this Notification model)
- **03-05**: Email scheduler (using EmailLog model and UserSetting email preferences)
- **03-06**: Notification API routes and UI (using NotificationType enum and Notification model)
- **03-07**: Settings UI extensions (using new UserSetting messaging_access and email toggle fields)
