---
phase: 03-real-time
plan: 02
subsystem: database
tags: [sequelize, migrations, models, chat, messaging, typescript]
dependency-graph:
  requires: [01-foundation, 02-core-social]
  provides: [chat-db-schema, chat-models, conversation-model, message-model, message-status-model]
  affects: [03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09]
tech-stack:
  added: []
  patterns: [denormalized-last-message, per-recipient-read-receipts, message-request-access-control, soft-delete-conversation-per-user]
key-files:
  created:
    - src/lib/db/migrations/033-create-conversations.cjs
    - src/lib/db/migrations/034-create-conversation-participants.cjs
    - src/lib/db/migrations/035-create-messages.cjs
    - src/lib/db/migrations/036-create-message-media.cjs
    - src/lib/db/migrations/037-create-message-status.cjs
    - src/lib/db/migrations/038-create-message-reactions.cjs
    - src/lib/db/migrations/039-create-message-requests.cjs
    - src/lib/db/models/Conversation.ts
    - src/lib/db/models/ConversationParticipant.ts
    - src/lib/db/models/Message.ts
    - src/lib/db/models/MessageMedia.ts
    - src/lib/db/models/MessageStatus.ts
    - src/lib/db/models/MessageReaction.ts
    - src/lib/db/models/MessageRequest.ts
  modified:
    - src/lib/db/models/index.ts
decisions:
  - Conversations use denormalized last_message_id and last_message_at for fast inbox sorting (no FK constraint on last_message_id to avoid circular dependency)
  - MessageStatus tracks per-recipient delivered/read with no timestamps option (only status_at matters)
  - ConversationParticipant uses deleted_at for per-user conversation deletion without removing group membership
  - MessageRequest uses unique (requester_id, recipient_id) constraint for one request per user pair
  - Message reactions use same 6 types as post reactions (like/love/haha/wow/sad/pray) for UI consistency
metrics:
  duration: 3 min
  completed: 2026-02-13
---

# Phase 3 Plan 2: Chat Database Schema & Models Summary

**7 migrations + 7 Sequelize models establishing the complete chat data layer for 1:1 and group conversations with media, read receipts, reactions, and message requests**

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Create chat database migrations (033-039) | b94584c | Done |
| 2 | Create Sequelize models and register associations | cdbf10b | Done |

## What Was Built

### Database Tables (7 new)
- **conversations** - Direct and group chat containers with denormalized last_message_id/last_message_at for fast inbox query sorting
- **conversation_participants** - Membership tracking with role (member/admin), last_read_at for unread calculation, soft delete via deleted_at
- **messages** - 5 message types (text/media/voice/shared_post/system) with reply threading via reply_to_id and shared post references
- **message_media** - Image/video/voice attachments with duration (for voice) and sort_order for multi-media messages
- **message_status** - Per-recipient delivered/read tracking for read receipts (no timestamps, only status_at)
- **message_reactions** - 6 reaction types matching post reactions for UI consistency
- **message_requests** - Pending/accepted/declined flow for messaging access control between non-followers

### Sequelize Models (7 new)
All models follow existing pattern: Model.init() with sequelize instance, DataTypes, underscored: true, timestamps: true. MessageStatus uses timestamps: false since it only tracks status_at. Each model has full TypeScript interfaces (Attributes + CreationAttributes with Optional fields).

### Associations Registered
All 7 new models registered in index.ts with complete bidirectional associations:
- Conversation -> User (creator), ConversationParticipant, Message, MessageRequest
- ConversationParticipant -> Conversation, User
- Message -> Conversation, User (sender), Message (replyTo/replies self-ref), Post (sharedPost), MessageMedia, MessageStatus, MessageReaction
- MessageMedia -> Message
- MessageStatus -> Message, User
- MessageReaction -> Message, User
- MessageRequest -> Conversation, User (requester), User (recipient)

### Indexes
- conversations: last_message_at (inbox sorting), creator_id
- conversation_participants: unique (conversation_id, user_id), user_id
- messages: (conversation_id, created_at) for history pagination, sender_id, reply_to_id
- message_media: message_id
- message_status: unique (message_id, user_id), user_id
- message_reactions: unique (message_id, user_id)
- message_requests: unique (requester_id, recipient_id), recipient_id, conversation_id

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx sequelize-cli db:migrate` - all 7 new migrations ran successfully
- All 7 tables confirmed in freeluma_dev database
- `npx tsc --noEmit` - zero TypeScript errors
- All models exported from index.ts with proper associations

## Next Phase Readiness

All subsequent Phase 3 chat plans can proceed. The database schema and model layer for chat is complete. Plans 03-03 through 03-09 can import Conversation, Message, and related models from `@/lib/db/models` and query all chat tables.
