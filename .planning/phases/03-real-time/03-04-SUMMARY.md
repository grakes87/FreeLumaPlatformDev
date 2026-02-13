---
phase: 03-real-time
plan: 04
subsystem: chat-api
tags: [rest-api, chat, messaging, conversations, socket-io, media-upload, cursor-pagination]
dependency-graph:
  requires: [03-02, 03-03]
  provides: [chat-rest-api, conversation-crud, message-crud, message-requests-api, chat-media-upload]
  affects: [03-05, 03-06, 03-07, 03-08, 03-09]
tech-stack:
  added: []
  patterns: [messaging-access-rules, cursor-pagination-newest-first, socket-io-event-emit-from-rest, batch-read-receipt, message-request-flow]
key-files:
  created:
    - src/app/api/chat/conversations/route.ts
    - src/app/api/chat/conversations/[id]/route.ts
    - src/app/api/chat/conversations/[id]/messages/route.ts
    - src/app/api/chat/conversations/[id]/participants/route.ts
    - src/app/api/chat/requests/route.ts
    - src/app/api/upload/chat-media/route.ts
  modified: []
decisions:
  - id: "message-request-creates-conversation"
    decision: "When access rules prevent direct DM, a Conversation is still created along with the MessageRequest"
    rationale: "Allows requester to send initial messages that recipient sees on accept; conversation stays hidden until request accepted"
  - id: "batch-read-receipt-on-fetch"
    decision: "GET messages updates participant last_read_at to now automatically"
    rationale: "Simplifies read receipt tracking without separate mark-as-read endpoint; viewing messages implies reading them"
  - id: "new-message-restores-deleted-conversations"
    decision: "POST message restores deleted_at on all soft-deleted participants in the conversation"
    rationale: "Per CONTEXT: deleted conversation restores with full history if new message received"
  - id: "chat-media-audio-support"
    decision: "Chat media upload accepts audio MIME types (mpeg, wav, ogg, webm, mp4, aac) for voice messages"
    rationale: "Voice messages are a core chat feature; post-media upload only allows image/video"
metrics:
  duration: 5 min
  completed: 2026-02-13
---

# Phase 3 Plan 4: Chat REST API Summary

**6 API route files implementing full chat CRUD: conversation list with search and unread counts, conversation creation with messaging access rules, message CRUD with cursor pagination and Socket.IO events, participant management, message request accept/decline flow, and chat media upload with voice support**

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Conversation list and creation API | 6780d52 | Done |
| 2 | Messages API, requests API, and chat media upload | 4372794 | Done |

## What Was Built

### Conversation Endpoints (2 route files)

**GET /api/chat/conversations** - Lists all conversations where user is an active participant. Includes:
- Last message preview (text truncated to 100 chars, or descriptive text for media/voice/shared_post)
- Sender display_name for group conversations
- Other participants with avatar info for direct conversations
- Unread count per conversation (messages after participant's last_read_at)
- Search by participant display_name/username via query param
- Separate messageRequests array for pending requests where user is recipient
- Sorted by last_message_at DESC (most recent first)
- Block filtering on participants and messages

**POST /api/chat/conversations** - Creates direct or group conversations:
- Direct: checks for existing conversation (restores soft-deleted if found)
- Messaging access rules: everyone/followers/mutual/nobody
- Creates MessageRequest when access rules prevent direct conversation
- Admin/moderator bypass on messaging access
- Block status check prevents conversations with blocked users
- Group: creator becomes admin, others become members, max 256 participants

**GET /api/chat/conversations/[id]** - Conversation detail with active participants
**DELETE /api/chat/conversations/[id]** - Per-user soft delete via participant deleted_at

### Message Endpoints (1 route file)

**GET /api/chat/conversations/[id]/messages** - Cursor-based pagination (newest first, 30/page):
- Includes sender info, media attachments, reply-to message with sender, shared post preview
- Reactions grouped by type with count and current user's reaction status
- Delivery status (sent/delivered/read) derived from MessageStatus records
- Unsent messages return null content with placeholder
- Block filtering on senders
- Batch read receipt: updates participant last_read_at on fetch

**POST /api/chat/conversations/[id]/messages** - Create message:
- Supports text, media, voice, shared_post types
- Profanity filter via checkAndFlag on content
- Creates MessageMedia rows for attachments
- Creates MessageStatus rows (delivered) for other participants
- Updates conversation last_message_id and last_message_at
- Restores soft-deleted participant records (new message restores conversation)
- Emits Socket.IO `message:new` event via chat namespace

**DELETE /api/chat/conversations/[id]/messages** - Unsend message:
- Sets is_unsent=true (only by sender)
- Emits Socket.IO `message:unsent` event

### Participant Endpoints (1 route file)

**POST /api/chat/conversations/[id]/participants** - Add to group (admin only, max 256)
**DELETE /api/chat/conversations/[id]/participants** - Remove from group (admin removes anyone, member can leave)
- Both emit Socket.IO events for real-time updates

### Message Requests (1 route file)

**GET /api/chat/requests** - List pending requests with requester info and message preview
**POST /api/chat/requests** - Accept (restores conversation) or decline (silent, one attempt only)

### Chat Media Upload (1 route file)

**GET /api/upload/chat-media** - Presigned URL for client-side upload
**POST /api/upload/chat-media** - Server-side upload via FormData
- Key prefix `chat/` for B2 storage
- Supports image, video, and audio MIME types (voice messages)
- Same pattern as existing post-media upload

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| MessageRequest creates hidden Conversation | Requester can send initial messages; recipient sees them on accept |
| Batch read receipt on GET messages | Viewing messages = reading them; no separate mark-as-read needed |
| New message restores deleted conversations | Per CONTEXT spec: deleted conversation restores on new message |
| Audio MIME support in chat upload | Voice messages need audio upload; post-media only supports image/video |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` -- zero TypeScript errors
- All 6 route files export proper HTTP methods (GET/POST/DELETE as specified)
- withAuth protects all routes
- Messaging access rules enforced (everyone/followers/mutual/nobody)
- Messages paginated with cursor (newest first, configurable limit)
- Socket.IO events emitted: message:new, message:unsent, participant:added, participant:removed
- Profanity filter applied to chat message content
- Block status checked on conversations, messages, and participant operations

## Next Phase Readiness

Chat REST API layer complete. Ready for:
- **03-05**: Socket.IO event handlers (typing indicators, room joins, real-time presence)
- **03-06**: Notification creation service (can trigger notifications on new messages)
- **03-07+**: Chat UI components can call these API routes
