# Phase 3: Real-Time - Research

**Researched:** 2026-02-13
**Domain:** Real-time communication (Socket.IO chat, notifications, email), voice messages, online presence
**Confidence:** HIGH

## Summary

Phase 3 adds real-time communication to FreeLuma: 1:1 and group chat with media/voice messages, an in-app notification activity feed with toast alerts, and email notifications for offline users. The core transport is Socket.IO v4.8.x running on the existing custom `server.js` (already created in Phase 1 with a placeholder comment for Socket.IO). Authentication reuses the existing `auth_token` HTTP-only cookie, which the browser sends automatically during the Socket.IO handshake since both run on the same origin.

The architecture follows a clear separation: Socket.IO handles ONLY real-time events (message delivery, typing indicators, online presence, notification pushes). All CRUD operations (creating conversations, sending messages that persist, fetching history) go through standard Next.js API routes, which then emit Socket.IO events via a shared `io` instance. This avoids the pitfall of putting business logic in socket event handlers.

The database layer adds ~8 new tables (conversations, conversation_participants, messages, message_status, notifications, email_logs, and potentially message_reactions, message_requests). Email notifications use the existing Nodemailer setup with a simple in-process job scheduler (node-cron) for batched/delayed email delivery and daily content reminders.

**Primary recommendation:** Use Socket.IO 4.8.x with namespace separation (`/chat` and `/notifications`), room-per-conversation for targeted message delivery, room-per-user for notification delivery, and the existing cursor-based pagination utility for message history. Voice messages use the browser's native MediaRecorder API recording to WebM/Opus format, uploaded to B2 via the existing presigned URL pattern.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | ^4.8.3 | Server-side WebSocket transport | Official Socket.IO server; 4.8.3 is latest stable (Dec 2025). Supports connection state recovery, namespaces, rooms, middleware auth |
| socket.io-client | ^4.8.3 | Client-side WebSocket transport | Paired with server; auto-reconnect, buffered events, volatile emits. Must match server major version |
| cookie | ^1.0.2 | Parse cookies from Socket.IO handshake headers | Lightweight (zero deps) cookie parser to extract `auth_token` from `socket.handshake.headers.cookie` |
| node-cron | ^3.0.3 | Schedule email jobs and cleanup tasks | Lightweight in-process cron scheduler; no Redis needed; crontab syntax. Runs inside the custom server process |
| nodemailer | ^8.0.1 | Email delivery | Already installed; used for password reset and verification emails. Extended for notification emails |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid | ^11.x | Generate conversation/message UUIDs | For message IDs used as cursor references and deduplication keys |
| date-fns | ^4.1.0 | Relative timestamps, date formatting | Already installed; used for "2 min ago" in chat and notification timestamps |
| date-fns-tz | ^3.2.0 | Timezone-aware scheduling | Already installed; needed for quiet hours and daily reminder time calculations |
| obscenity | ^0.4.6 | Profanity filter for chat messages | Already installed; reuse `checkAndFlag()` from `src/lib/moderation/profanity.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron (in-process) | BullMQ + Redis | BullMQ provides persistence, retry, and distributed processing but requires Redis infrastructure. node-cron is sufficient for single-server with <10k users |
| cookie (manual parse) | cookie-parser (Express middleware) | cookie-parser is designed for Express; we only need to parse one cookie header string in Socket.IO middleware, so the raw `cookie` package is simpler |
| In-memory presence Map | Redis presence | Redis provides cross-server presence but adds infrastructure. In-memory Map is correct for single-server deployment |
| Custom toast system | react-toastify | The project already has a custom Toast provider; extending it for notification toasts maintains consistency |

**Installation:**
```bash
npm install socket.io@^4.8.3 socket.io-client@^4.8.3 cookie@^1.0.2 node-cron@^3.0.3 uuid@^11.0.0
npm install -D @types/cookie @types/node-cron @types/uuid
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── socket/
│   │   ├── index.ts              # Socket.IO server init, namespace setup, export `io`
│   │   ├── auth.ts               # Socket middleware: parse cookie, verify JWT, attach user
│   │   ├── chat.ts               # /chat namespace handlers (message, typing, read receipt)
│   │   ├── notifications.ts      # /notifications namespace handlers (subscribe, mark-read)
│   │   └── presence.ts           # Online/offline tracking (Map<userId, Set<socketId>>)
│   ├── email/
│   │   ├── index.ts              # Existing sendEmail, sendPasswordResetEmail, etc.
│   │   ├── templates.ts          # Existing + new notification email templates
│   │   ├── queue.ts              # Email batching/throttling logic
│   │   └── scheduler.ts          # node-cron jobs: DM batch emails, daily reminders, cleanup
│   ├── notifications/
│   │   ├── create.ts             # createNotification() — writes DB + emits Socket.IO
│   │   ├── group.ts              # Notification grouping/collapsing logic
│   │   └── types.ts              # NotificationType enum, notification payload types
│   ├── db/
│   │   ├── models/
│   │   │   ├── Conversation.ts
│   │   │   ├── ConversationParticipant.ts
│   │   │   ├── Message.ts
│   │   │   ├── MessageReaction.ts
│   │   │   ├── MessageRequest.ts
│   │   │   ├── Notification.ts
│   │   │   └── EmailLog.ts
│   │   └── migrations/
│   │       ├── 033-create-conversations.cjs
│   │       ├── 034-create-conversation-participants.cjs
│   │       ├── 035-create-messages.cjs
│   │       ├── 036-create-message-reactions.cjs
│   │       ├── 037-create-message-requests.cjs
│   │       ├── 038-create-notifications.cjs
│   │       ├── 039-create-email-logs.cjs
│   │       ├── 040-add-messaging-access-to-user-settings.cjs
│   │       └── 041-add-notification-prefs-to-user-settings.cjs
│   └── utils/
│       └── cursor.ts             # Existing cursor pagination (reused for messages)
├── app/
│   ├── (app)/
│   │   ├── chat/
│   │   │   ├── page.tsx          # Conversation list
│   │   │   └── [conversationId]/
│   │   │       └── page.tsx      # Chat view (hides bottom nav)
│   │   └── notifications/
│   │       └── page.tsx          # Full notification activity feed
│   └── api/
│       ├── chat/
│       │   ├── conversations/
│       │   │   ├── route.ts      # GET list, POST create
│       │   │   └── [id]/
│       │   │       ├── route.ts  # GET conversation detail, DELETE
│       │   │       ├── messages/
│       │   │       │   └── route.ts  # GET messages (paginated), POST send
│       │   │       └── participants/
│       │   │           └── route.ts  # POST add, DELETE remove (group)
│       │   ├── requests/
│       │   │   └── route.ts      # GET message requests, POST accept/decline
│       │   └── voice/
│       │       └── route.ts      # GET presigned URL for voice upload
│       ├── notifications/
│       │   ├── route.ts          # GET paginated notifications, PUT mark-read
│       │   └── clear/
│       │       └── route.ts      # DELETE clear all
│       └── upload/
│           └── chat-media/
│               └── route.ts      # POST upload chat media (images, video, voice)
├── components/
│   ├── chat/
│   │   ├── ConversationList.tsx
│   │   ├── ConversationItem.tsx
│   │   ├── ChatView.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx
│   │   ├── VoiceRecorder.tsx
│   │   ├── MediaAttachmentSheet.tsx
│   │   ├── MessageReactionPicker.tsx
│   │   ├── MessageContextMenu.tsx
│   │   ├── TypingIndicator.tsx
│   │   ├── OnlineStatusDot.tsx
│   │   ├── UserPicker.tsx
│   │   ├── GroupInfoSheet.tsx
│   │   ├── MessageRequestBanner.tsx
│   │   └── SharedPostCard.tsx
│   └── notifications/
│       ├── NotificationDropdown.tsx   # Replaces current empty dropdown in TopBar
│       ├── NotificationItem.tsx
│       ├── NotificationToast.tsx
│       └── NotificationFilters.tsx
├── context/
│   ├── SocketContext.tsx          # Socket.IO client provider (connects on auth)
│   └── NotificationContext.tsx    # Unread counts, toast queue
└── hooks/
    ├── useSocket.ts              # Access socket from context
    ├── useChat.ts                # Chat state: messages, typing, send
    ├── useConversations.ts       # Conversation list with real-time updates
    ├── usePresence.ts            # Online status tracking
    ├── useNotifications.ts       # Notification feed + unread count
    ├── useVoiceRecorder.ts       # MediaRecorder + waveform
    └── useMessageStatus.ts       # Sent/delivered/read tracking
```

### Pattern 1: Socket.IO Server Initialization (shared `io` instance)

**What:** Initialize Socket.IO on the existing HTTP server, export the `io` instance so API routes can emit events.
**When to use:** Server startup in `server.js`.

```typescript
// server.js (updated)
import { createServer } from "node:http";
import next from "next";
import { initSocketServer } from "./src/lib/socket/index.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  initSocketServer(httpServer);
  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
```

```typescript
// src/lib/socket/index.ts
import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { authMiddleware } from "./auth";
import { registerChatHandlers } from "./chat";
import { registerNotificationHandlers } from "./notifications";
import { presenceManager } from "./presence";

let io: SocketServer | null = null;

export function getIO(): SocketServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function initSocketServer(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    },
    // No CORS needed — same origin
  });

  // /chat namespace
  const chatNsp = io.of("/chat");
  chatNsp.use(authMiddleware);
  chatNsp.on("connection", (socket) => {
    registerChatHandlers(chatNsp, socket);
    presenceManager.addUser(socket.data.userId, socket.id);
    socket.on("disconnect", () => {
      presenceManager.removeSocket(socket.data.userId, socket.id);
    });
  });

  // /notifications namespace
  const notifNsp = io.of("/notifications");
  notifNsp.use(authMiddleware);
  notifNsp.on("connection", (socket) => {
    registerNotificationHandlers(notifNsp, socket);
    // Join user-specific room for targeted notifications
    socket.join(`user:${socket.data.userId}`);
  });

  // Memory leak prevention (per pitfalls research)
  io.engine.on("connection", (rawSocket: any) => {
    rawSocket.request = null;
  });

  return io;
}
```

### Pattern 2: Cookie-based JWT Auth for Socket.IO

**What:** Extract `auth_token` from the HTTP-only cookie during Socket.IO handshake and verify with existing `verifyJWT`.
**When to use:** Socket.IO namespace middleware.

```typescript
// src/lib/socket/auth.ts
import { parse as parseCookie } from "cookie";
import { verifyJWT } from "@/lib/auth/jwt";
import type { Socket } from "socket.io";

export async function authMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      return next(new Error("No auth cookie"));
    }

    const cookies = parseCookie(cookieHeader);
    const token = cookies.auth_token;
    if (!token) {
      return next(new Error("No auth token"));
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return next(new Error("Invalid token"));
    }

    // Attach user data to socket for use in handlers
    socket.data.userId = payload.id;
    socket.data.email = payload.email;
    next();
  } catch (err) {
    next(new Error("Authentication failed"));
  }
}
```

### Pattern 3: Room-per-Conversation for Targeted Delivery

**What:** Each conversation gets a Socket.IO room (`conv:{id}`). Messages are emitted only to that room.
**When to use:** When a message is sent via API route, emit to the conversation room.

```typescript
// In API route after persisting message to DB:
import { getIO } from "@/lib/socket";

// After creating message in DB
const io = getIO();
const chatNsp = io.of("/chat");
chatNsp.to(`conv:${conversationId}`).emit("message:new", {
  id: message.id,
  conversation_id: conversationId,
  sender_id: userId,
  content: message.content,
  media: message.media,
  created_at: message.created_at,
});

// User joins conversation room on opening chat
// In chat namespace handler:
socket.on("conversation:join", (conversationId: number) => {
  // Verify user is a participant (check DB)
  socket.join(`conv:${conversationId}`);
});
```

### Pattern 4: Notification Creation + Real-time Push

**What:** Centralized notification creation that writes to DB AND pushes via Socket.IO.
**When to use:** Whenever an event triggers a notification (reaction, comment, follow, prayer, DM).

```typescript
// src/lib/notifications/create.ts
import { getIO } from "@/lib/socket";

interface CreateNotificationParams {
  recipient_id: number;
  actor_id: number;
  type: NotificationType;
  entity_type: 'post' | 'comment' | 'follow' | 'prayer_request' | 'message' | 'daily_content';
  entity_id: number;
  preview_text?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  const { Notification, User } = await import("@/lib/db/models");

  // Don't notify yourself
  if (params.recipient_id === params.actor_id) return;

  // Check block status
  const { getBlockedUserIds } = await import("@/lib/utils/blocks");
  const blocked = await getBlockedUserIds(params.recipient_id);
  if (blocked.has(params.actor_id)) return;

  // Create in DB
  const notification = await Notification.create(params);

  // Get actor info for display
  const actor = await User.findByPk(params.actor_id, {
    attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
  });

  // Push via Socket.IO
  try {
    const io = getIO();
    io.of("/notifications").to(`user:${params.recipient_id}`).emit("notification:new", {
      ...notification.toJSON(),
      actor,
    });
  } catch {
    // Socket.IO may not be initialized in tests
  }

  return notification;
}
```

### Pattern 5: Client-side Socket Context

**What:** React context providing socket connections that auto-connect on auth and disconnect on logout.
**When to use:** Wrap the authenticated app layout.

```typescript
// src/context/SocketContext.tsx
"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";

interface SocketContextValue {
  chatSocket: Socket | null;
  notifSocket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  chatSocket: null,
  notifSocket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const chatRef = useRef<Socket | null>(null);
  const notifRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Same origin — cookies sent automatically
    const chatSocket = io("/chat", { autoConnect: true });
    const notifSocket = io("/notifications", { autoConnect: true });

    chatRef.current = chatSocket;
    notifRef.current = notifSocket;

    chatSocket.on("connect", () => setIsConnected(true));
    chatSocket.on("disconnect", () => setIsConnected(false));

    return () => {
      chatSocket.disconnect();
      notifSocket.disconnect();
      chatRef.current = null;
      notifRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider
      value={{
        chatSocket: chatRef.current,
        notifSocket: notifRef.current,
        isConnected,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
```

### Pattern 6: Typing Indicator with Debounce + Volatile Emit

**What:** Client debounces keystrokes, emits typing status via volatile (droppable) events. Server broadcasts to conversation room.
**When to use:** In chat message input.

```typescript
// Client-side hook
function useTypingIndicator(socket: Socket | null, conversationId: number) {
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const isTyping = useRef(false);

  const handleTyping = useCallback(() => {
    if (!socket) return;

    if (!isTyping.current) {
      isTyping.current = true;
      socket.volatile.emit("typing:start", { conversationId });
    }

    // Reset the "stop typing" timer
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      isTyping.current = false;
      socket.volatile.emit("typing:stop", { conversationId });
    }, 2000); // 2s debounce
  }, [socket, conversationId]);

  return handleTyping;
}

// Server-side handler
socket.on("typing:start", ({ conversationId }) => {
  socket.to(`conv:${conversationId}`).volatile.emit("typing:start", {
    userId: socket.data.userId,
  });
});

socket.on("typing:stop", ({ conversationId }) => {
  socket.to(`conv:${conversationId}`).volatile.emit("typing:stop", {
    userId: socket.data.userId,
  });
});
```

### Anti-Patterns to Avoid

- **Business logic in socket handlers:** Socket handlers should only relay events. Message persistence, validation, and authorization belong in API routes. The socket event is emitted AFTER the API route succeeds.
- **Broadcasting to all clients:** Never use `io.emit()`. Always use rooms (`conv:{id}`, `user:{id}`) for targeted delivery.
- **Polling for new messages:** Messages must arrive via Socket.IO events. REST API is only for loading history (scroll-up pagination).
- **Storing socket mappings without cleanup:** Always remove socket from user's socket set on `disconnect` event. Use `Map<number, Set<string>>` (userId -> socketIds) to support multiple devices.
- **Synchronous DB calls in Socket.IO middleware:** The auth middleware must be async. Use `async function authMiddleware(socket, next)` pattern.
- **Forgetting useEffect cleanup for socket listeners:** Every `socket.on()` in a React component must have a corresponding `socket.off()` in the useEffect cleanup to prevent duplicate event handlers.

## Database Schema Design

### Conversations Table
```sql
CREATE TABLE conversations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type          ENUM('direct', 'group') NOT NULL DEFAULT 'direct',
  name          VARCHAR(100) NULL,          -- Group name; NULL for direct
  avatar_url    VARCHAR(500) NULL,          -- Group photo; NULL for direct
  creator_id    INT NULL,                   -- Group creator (admin); NULL for direct
  last_message_id INT NULL,                 -- Denormalized for fast list sort
  last_message_at DATETIME NULL,            -- Denormalized for fast list sort
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);
```

### Conversation Participants Table
```sql
CREATE TABLE conversation_participants (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  user_id         INT NOT NULL,
  role            ENUM('member', 'admin') NOT NULL DEFAULT 'member',
  last_read_at    DATETIME NULL,            -- For unread count calculation
  deleted_at      DATETIME NULL,            -- Soft delete: "delete conversation" for this user
  joined_at       DATETIME NOT NULL,
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY idx_conv_user (conversation_id, user_id)
);
CREATE INDEX idx_cp_user_id ON conversation_participants(user_id);
```

### Messages Table
```sql
CREATE TABLE messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id       INT NOT NULL,
  type            ENUM('text', 'media', 'voice', 'shared_post', 'system') NOT NULL DEFAULT 'text',
  content         TEXT NULL,                -- Text content; NULL for media-only
  reply_to_id     INT NULL,                 -- Quote-reply reference
  shared_post_id  INT NULL,                 -- Shared post reference
  is_unsent       BOOLEAN NOT NULL DEFAULT FALSE,
  flagged         BOOLEAN NOT NULL DEFAULT FALSE,  -- Profanity flag
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (reply_to_id) REFERENCES messages(id),
  FOREIGN KEY (shared_post_id) REFERENCES posts(id)
);
CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
```

### Message Media Table
```sql
CREATE TABLE message_media (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  message_id  INT NOT NULL,
  media_url   VARCHAR(500) NOT NULL,
  media_type  ENUM('image', 'video', 'voice') NOT NULL,
  duration    INT NULL,                    -- Voice message duration in seconds
  sort_order  TINYINT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL,
  updated_at  DATETIME NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);
CREATE INDEX idx_message_media_msg ON message_media(message_id);
```

### Message Status Table (for read receipts in 1:1)
```sql
CREATE TABLE message_status (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  message_id  INT NOT NULL,
  user_id     INT NOT NULL,               -- The recipient
  status      ENUM('delivered', 'read') NOT NULL DEFAULT 'delivered',
  status_at   DATETIME NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY idx_msg_user_status (message_id, user_id)
);
```

### Message Reactions Table
```sql
CREATE TABLE message_reactions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  message_id    INT NOT NULL,
  user_id       INT NOT NULL,
  reaction_type ENUM('like', 'love', 'haha', 'wow', 'sad', 'pray') NOT NULL,
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY idx_msg_reaction_user (message_id, user_id)
);
```

### Message Requests Table
```sql
CREATE TABLE message_requests (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  requester_id    INT NOT NULL,
  recipient_id    INT NOT NULL,
  status          ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (recipient_id) REFERENCES users(id),
  UNIQUE KEY idx_request_pair (requester_id, recipient_id)
);
```

### Notifications Table
```sql
CREATE TABLE notifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  recipient_id  INT NOT NULL,
  actor_id      INT NOT NULL,
  type          ENUM('follow', 'follow_request', 'reaction', 'comment', 'prayer', 'message', 'mention', 'group_invite', 'daily_reminder') NOT NULL,
  entity_type   ENUM('post', 'comment', 'follow', 'prayer_request', 'message', 'conversation', 'daily_content') NOT NULL,
  entity_id     INT NOT NULL,
  preview_text  VARCHAR(200) NULL,
  group_key     VARCHAR(100) NULL,          -- For collapsing: "reaction:post:123"
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  FOREIGN KEY (recipient_id) REFERENCES users(id),
  FOREIGN KEY (actor_id) REFERENCES users(id)
);
CREATE INDEX idx_notif_recipient_read ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_notif_group_key ON notifications(group_key, recipient_id);
CREATE INDEX idx_notif_created_at ON notifications(created_at);
```

### Email Logs Table
```sql
CREATE TABLE email_logs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  recipient_id  INT NOT NULL,
  email_type    ENUM('dm_batch', 'follow_request', 'prayer_response', 'daily_reminder') NOT NULL,
  subject       VARCHAR(255) NOT NULL,
  status        ENUM('queued', 'sent', 'bounced', 'opened') NOT NULL DEFAULT 'queued',
  sent_at       DATETIME NULL,
  opened_at     DATETIME NULL,
  tracking_id   VARCHAR(100) NULL,          -- UUID for tracking pixel
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  FOREIGN KEY (recipient_id) REFERENCES users(id)
);
CREATE INDEX idx_email_log_status ON email_logs(status, created_at);
CREATE INDEX idx_email_log_tracking ON email_logs(tracking_id);
```

### UserSetting Extensions
```sql
-- Add to existing user_settings table
ALTER TABLE user_settings ADD COLUMN messaging_access ENUM('everyone', 'followers', 'mutual', 'nobody') NOT NULL DEFAULT 'mutual';
ALTER TABLE user_settings ADD COLUMN email_dm_notifications BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN email_follow_notifications BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN email_prayer_notifications BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN email_daily_reminder BOOLEAN NOT NULL DEFAULT TRUE;
```

### Notification Grouping Strategy

Notifications are grouped by `group_key`, which encodes the notification type and target entity:
- `reaction:post:123` -- all reactions on post 123
- `comment:post:123` -- all comments on post 123
- `prayer:prayer_request:456` -- all prayers on request 456

When displaying, query the latest notification per `group_key` and count the total actors:

```sql
-- Get grouped notifications for a user
SELECT
  n.*,
  (SELECT COUNT(DISTINCT actor_id)
   FROM notifications n2
   WHERE n2.group_key = n.group_key
     AND n2.recipient_id = n.recipient_id) as actor_count
FROM notifications n
WHERE n.recipient_id = ?
  AND n.id IN (
    SELECT MAX(id) FROM notifications
    WHERE recipient_id = ?
    GROUP BY COALESCE(group_key, CONCAT('single:', id))
  )
ORDER BY n.created_at DESC
LIMIT 20;
```

This produces "John and 3 others reacted to your post" by getting the latest actor + count.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie parsing | Custom string split | `cookie` npm package | Edge cases with encoding, semicolons, quotes; the `cookie` package handles RFC 6265 correctly |
| WebSocket transport | Raw `ws` library | `socket.io` (server) + `socket.io-client` | Socket.IO adds auto-reconnection, rooms, namespaces, fallback to long-polling, connection state recovery, volatile emits. Raw WebSocket requires building all of this |
| Cron scheduling | Custom setInterval chains | `node-cron` | Cron expression parsing, timezone support, proper scheduling semantics |
| Audio recording | Custom AudioContext recorder | `MediaRecorder` API (native) | Browser-native, handles encoding, memory management, and codec negotiation. Polyfills exist for Safari edge cases |
| Waveform visualization | Custom FFT analysis | `AnalyserNode` from Web Audio API | Built into browsers; provides `getByteFrequencyData()` for real-time frequency data visualization with no dependencies |
| Email unsubscribe | Custom token + route | Standard `List-Unsubscribe` header + one-click token route | RFC 8058 one-click unsubscribe; required by Gmail/Yahoo for bulk senders. Nodemailer supports custom headers |
| Cursor pagination | Custom offset logic | Existing `src/lib/utils/cursor.ts` | Already built and tested in Phase 2; reuse for message history pagination |
| Profanity filtering | Custom word list | Existing `src/lib/moderation/profanity.ts` | Already built with `obscenity` library; handles leet-speak, confusables |

**Key insight:** The browser provides native MediaRecorder and Web Audio APIs that are sufficient for voice recording and waveform visualization. No npm audio library is needed. The native APIs record directly to WebM/Opus format (supported in Chrome, Firefox, Safari 18.4+), which is the most efficient codec for voice.

## Common Pitfalls

### Pitfall 1: Socket.IO Memory Leak from HTTP Request References

**What goes wrong:** Socket.IO's Engine.IO layer holds a reference to the original HTTP upgrade request object on each connection. For long-lived connections, this prevents garbage collection of the request (and all its headers, body, etc.), causing memory to grow linearly with connection count.
**Why it happens:** This is a known Socket.IO behavior documented in performance tuning guides. The request object is retained for the lifetime of the connection.
**How to avoid:** Null out the request reference after the handshake completes:
```typescript
io.engine.on("connection", (rawSocket: any) => {
  rawSocket.request = null;
});
```
**Warning signs:** Memory usage grows over time even with stable connection count.

### Pitfall 2: Duplicate Event Handlers in React useEffect

**What goes wrong:** Each React re-render can add a new `socket.on()` listener without removing the previous one. This causes messages to be received multiple times, reactions to fire twice, etc.
**Why it happens:** React's useEffect runs on every re-render (or on dependency changes). Without cleanup, `socket.on("message:new", handler)` accumulates handlers.
**How to avoid:** Always return a cleanup function:
```typescript
useEffect(() => {
  if (!socket) return;
  const handler = (msg: Message) => setMessages(prev => [...prev, msg]);
  socket.on("message:new", handler);
  return () => { socket.off("message:new", handler); };
}, [socket]);
```
**Warning signs:** Messages appear duplicated in the UI. Console logs fire multiple times per event.

### Pitfall 3: Conversation Room Joins Without Authorization

**What goes wrong:** A malicious user emits `conversation:join` with any conversation ID and receives messages from conversations they are not a participant in.
**Why it happens:** Developers trust the authenticated user to only join their own conversations, but socket events can be crafted by any authenticated user.
**How to avoid:** Always verify participation before allowing room joins:
```typescript
socket.on("conversation:join", async (conversationId) => {
  const participant = await ConversationParticipant.findOne({
    where: { conversation_id: conversationId, user_id: socket.data.userId, deleted_at: null },
  });
  if (!participant) return; // Silently reject
  socket.join(`conv:${conversationId}`);
});
```
**Warning signs:** Users see messages from conversations they were removed from.

### Pitfall 4: Message Status Updates Creating N+1 Write Storms

**What goes wrong:** When a user opens a conversation with 100 unread messages, the client sends 100 individual "mark as read" events, each triggering a database UPDATE.
**Why it happens:** Naive implementation marks each message as read individually.
**How to avoid:** Batch read receipts. When the user opens a conversation, send a single "conversation:read" event with a timestamp. The server updates all messages before that timestamp in one query:
```typescript
// Server-side: single UPDATE instead of N updates
await MessageStatus.update(
  { status: 'read', status_at: new Date() },
  {
    where: {
      message_id: { [Op.in]: unreadMessageIds },
      user_id: recipientId,
    },
  }
);
```
**Warning signs:** Database CPU spikes when users open conversations with many unread messages.

### Pitfall 5: Voice Message Recording Fails Silently on Safari

**What goes wrong:** `MediaRecorder` with `audio/webm;codecs=opus` throws on older Safari versions (pre-18.4). The recording UI appears to work but no audio data is captured.
**Why it happens:** Safari only recently added WebM/Opus support (Safari 18.4+). Older versions support `audio/mp4;codecs=aac` instead.
**How to avoid:** Feature-detect the supported MIME type:
```typescript
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',  // Chrome, Firefox, Safari 18.4+
  'audio/mp4;codecs=aac',    // Safari fallback
  'audio/webm',              // Generic WebM
];
const mimeType = PREFERRED_MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t));
if (!mimeType) {
  // Show "Voice messages not supported on this browser" message
}
```
**Warning signs:** Voice recording works in Chrome but produces empty files in Safari.

### Pitfall 6: Email Rate Limiting Ignored, User Gets 50 Emails in 10 Minutes

**What goes wrong:** A popular post gets many reactions/comments quickly. Each triggers a notification email. The user's inbox is flooded.
**Why it happens:** Each notification independently triggers an email without checking what emails were recently sent.
**How to avoid:** Implement email throttling at the queue level:
1. Check `email_logs` for recent emails to this user in the last hour
2. If count >= max (3-5), skip or batch
3. For DMs specifically: wait 15 minutes, then send a single "You have X unread messages from Y" email
**Warning signs:** Users report email spam. Unsubscribe rate spikes.

### Pitfall 7: Online Presence Not Cleaned Up on Server Restart

**What goes wrong:** After a server restart, the in-memory presence Map is empty, but Socket.IO clients auto-reconnect. The reconnection re-populates presence, but there is a brief window where all users appear offline.
**Why it happens:** Presence is stored in memory (Map), which does not survive process restarts.
**How to avoid:** Accept the brief gap. On client reconnect, immediately re-emit presence. On server startup, the Map is empty (correct -- no one is connected yet). As clients reconnect (which happens within seconds due to Socket.IO auto-reconnect), presence rebuilds automatically. For the client side, handle the "connect" event to re-announce presence.
**Warning signs:** After deployment, all users show as offline for 5-10 seconds.

## Code Examples

### Voice Recording with Waveform Visualization

```typescript
// src/hooks/useVoiceRecorder.ts
"use client";
import { useState, useRef, useCallback, useEffect } from "react";

const MAX_DURATION_MS = 60_000; // 60 seconds

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=aac",
  "audio/webm",
];

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // 0-1 for waveform
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const animFrame = useRef<number>(0);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startTime = useRef(0);

  const mimeType = PREFERRED_MIME_TYPES.find((t) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)
  );

  const startRecording = useCallback(async () => {
    if (!mimeType) throw new Error("Voice recording not supported");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Set up analyser for waveform
    audioContext.current = new AudioContext();
    const source = audioContext.current.createMediaStreamSource(stream);
    analyser.current = audioContext.current.createAnalyser();
    analyser.current.fftSize = 256;
    source.connect(analyser.current);

    // Animate audio level
    const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
    const updateLevel = () => {
      if (!analyser.current) return;
      analyser.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(avg / 255);
      animFrame.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();

    // Start recording
    const recorder = new MediaRecorder(stream, { mimeType });
    chunks.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    mediaRecorder.current = recorder;
    recorder.start(100); // Collect data every 100ms

    startTime.current = Date.now();
    setIsRecording(true);
    setDuration(0);

    // Duration timer
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
      setDuration(elapsed);
      if (elapsed >= 60) stopRecording(); // Auto-stop at 60s
    }, 1000);
  }, [mimeType]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorder.current || mediaRecorder.current.state === "inactive") {
        resolve(null);
        return;
      }

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: mimeType });
        resolve(blob);
      };

      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrame.current);
      audioContext.current?.close();
      setIsRecording(false);
      setAudioLevel(0);
    });
  }, [mimeType]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach((t) => t.stop());
    }
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrame.current);
    audioContext.current?.close();
    chunks.current = [];
    setIsRecording(false);
    setDuration(0);
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrame.current);
      clearInterval(timerRef.current);
    };
  }, []);

  return {
    isRecording,
    duration,
    audioLevel,
    isSupported: !!mimeType,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
```

### Online Presence Manager (Server-side)

```typescript
// src/lib/socket/presence.ts

/**
 * In-memory presence tracking.
 * Maps userId -> Set of socketIds (supports multiple devices/tabs).
 */
class PresenceManager {
  private userSockets = new Map<number, Set<string>>();

  addUser(userId: number, socketId: string) {
    const sockets = this.userSockets.get(userId) || new Set();
    sockets.add(socketId);
    this.userSockets.set(userId, sockets);
  }

  removeSocket(userId: number, socketId: string) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.userSockets.delete(userId);
    }
  }

  isOnline(userId: number): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  getOnlineUserIds(): number[] {
    return Array.from(this.userSockets.keys());
  }

  getOnlineStatusBulk(userIds: number[]): Map<number, boolean> {
    const result = new Map<number, boolean>();
    for (const id of userIds) {
      result.set(id, this.isOnline(id));
    }
    return result;
  }
}

export const presenceManager = new PresenceManager();
```

### Email Notification Queue

```typescript
// src/lib/email/scheduler.ts
import cron from "node-cron";

/**
 * Initialize email notification cron jobs.
 * Call once from server.js after httpServer.listen().
 */
export function initEmailScheduler() {
  // Check for batched DM emails every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await processDMEmailBatch();
    } catch (err) {
      console.error("[Email Scheduler] DM batch error:", err);
    }
  });

  // Send daily content reminder at the top of each hour
  // (checks each user's configured reminder time and timezone)
  cron.schedule("0 * * * *", async () => {
    try {
      await processDailyReminders();
    } catch (err) {
      console.error("[Email Scheduler] Daily reminder error:", err);
    }
  });

  // Clean up old notifications (30-day retention)
  cron.schedule("0 3 * * *", async () => {
    try {
      await cleanupOldNotifications();
    } catch (err) {
      console.error("[Email Scheduler] Cleanup error:", err);
    }
  });

  console.log("[Email Scheduler] Cron jobs initialized");
}
```

### Notification Toast (Client-side)

```typescript
// src/components/notifications/NotificationToast.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface NotificationPayload {
  id: number;
  type: string;
  actor: { display_name: string; avatar_url: string | null; avatar_color: string };
  preview_text?: string;
  entity_type: string;
  entity_id: number;
}

const TYPE_COLORS: Record<string, string> = {
  reaction: "border-l-pink-500",
  comment: "border-l-blue-500",
  follow: "border-l-green-500",
  follow_request: "border-l-green-500",
  prayer: "border-l-purple-500",
  message: "border-l-teal-500",
  mention: "border-l-orange-500",
};

export function NotificationToastManager() {
  const { notifSocket } = useSocket();
  const pathname = usePathname();
  const [queue, setQueue] = useState<NotificationPayload[]>([]);
  const [current, setCurrent] = useState<NotificationPayload | null>(null);

  // Show next toast from queue
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);

    // Auto-dismiss after 3.5s
    const timer = setTimeout(() => setCurrent(null), 3500);
    return () => clearTimeout(timer);
  }, [current, queue]);

  // Listen for notifications
  useEffect(() => {
    if (!notifSocket) return;

    const handler = (payload: NotificationPayload) => {
      // Suppress chat toasts when viewing that conversation
      if (payload.type === "message" && pathname?.includes(`/chat/${payload.entity_id}`)) {
        return;
      }
      setQueue((prev) => [...prev, payload]);
    };

    notifSocket.on("notification:new", handler);
    return () => { notifSocket.off("notification:new", handler); };
  }, [notifSocket, pathname]);

  if (!current) return null;

  return (
    <div className={cn(
      "fixed top-16 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm",
      "animate-slide-down rounded-xl border-l-4 bg-surface/95 p-3 shadow-lg backdrop-blur-md",
      "dark:bg-surface-dark/95",
      TYPE_COLORS[current.type] || "border-l-primary"
    )}>
      <p className="text-sm font-medium text-text dark:text-text-dark">
        {current.actor.display_name}
      </p>
      <p className="text-xs text-text-muted dark:text-text-muted-dark">
        {current.preview_text}
      </p>
    </div>
  );
}
```

### Message Cursor Pagination (Reusing Existing Utility)

```typescript
// In API route: GET /api/chat/conversations/[id]/messages
import { decodeCursor, encodeCursor } from "@/lib/utils/cursor";
import { Op } from "sequelize";

const MESSAGES_PER_PAGE = 30;

// Decode cursor from query param
const cursorParam = searchParams.get("cursor");
const cursor = cursorParam ? decodeCursor(cursorParam) : null;

const whereClause: any = { conversation_id: conversationId };
if (cursor) {
  whereClause[Op.or] = [
    { created_at: { [Op.lt]: cursor.created_at } },
    {
      created_at: cursor.created_at,
      id: { [Op.lt]: cursor.id },
    },
  ];
}

const messages = await Message.findAll({
  where: whereClause,
  order: [["created_at", "DESC"], ["id", "DESC"]],
  limit: MESSAGES_PER_PAGE + 1, // Fetch one extra to check hasMore
  include: [/* sender, media, reply_to, reactions */],
});

const hasMore = messages.length > MESSAGES_PER_PAGE;
const results = hasMore ? messages.slice(0, MESSAGES_PER_PAGE) : messages;
const nextCursor = results.length > 0
  ? encodeCursor(results[results.length - 1])
  : null;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Socket.IO without connection state recovery | Connection state recovery (v4.6.0+) | Feb 2023 | Automatic reconnection restores rooms, socket ID, and missed events for disconnections up to `maxDisconnectionDuration` |
| Polling for message status | Socket.IO volatile emits for typing + status | Socket.IO v4.x | Real-time status without polling; volatile ensures no buffer overflow |
| `audio/mp4` only in Safari | Safari 18.4+ supports `audio/webm;codecs=opus` | Safari 18.4 (2025) | Cross-browser WebM/Opus now works everywhere; still need fallback for older Safari |
| Custom reconnection logic | Socket.IO built-in reconnection with exponential backoff | Socket.IO v4.x | Client auto-reconnects with configurable delay; manual retry logic unnecessary |
| Separate WebSocket server process | Same HTTP server with Socket.IO mounted | Standard pattern | Socket.IO shares the httpServer with Next.js; single port, no proxy needed |

**Deprecated/outdated:**
- `socket.io-cookie-parser`: Unnecessary with the lightweight `cookie` package for parsing a single header
- `@socket.io/sticky`: Only needed for horizontal scaling with multiple server instances; not needed for single-server deployment
- `web-push` library for browser push: CONTEXT explicitly states NO browser push notifications

## Open Questions

1. **Socket.IO import path in API routes**
   - What we know: The `io` instance lives in `src/lib/socket/index.ts` and is initialized in `server.js`. API routes need to call `getIO()` to emit events.
   - What's unclear: With Next.js App Router, API routes run in the Node.js runtime but module caching behavior between the custom server and API route bundles may differ. The `globalThis` pattern (already used for Sequelize) may be needed for the `io` singleton.
   - Recommendation: Use the same `globalThis` caching pattern as `src/lib/db/index.ts`. Store the `io` instance on `globalThis` in dev to survive HMR reloads. Test early that `getIO()` returns the correct instance from within API routes.

2. **Group chat with 256 members: read receipt storage**
   - What we know: In 1:1 chats, read receipts are simple (one row per message per recipient). In group chats with 256 members, a single message could generate 255 status rows.
   - What's unclear: Whether to track individual read status per member in groups, or use a simpler "last_read_at" per participant.
   - Recommendation: For groups, use only the `conversation_participants.last_read_at` field (no per-message status rows). Messages sent before `last_read_at` are considered read. This avoids the N*M write amplification problem. Per-message read receipts (checkmarks) are only shown in 1:1 conversations, consistent with WhatsApp behavior.

3. **Email open tracking accuracy**
   - What we know: Tracking pixels work by embedding a 1x1 image that loads when the email is opened. Apple Mail pre-loads all images, inflating open rates. Gmail proxies images.
   - What's unclear: Whether the tracking data will be accurate enough to be useful for the admin dashboard.
   - Recommendation: Implement tracking pixel anyway (simple to add, ~20 lines). Surface the data in admin dashboard with a disclaimer that open rates are approximate. The "sent" and "bounced" statuses are reliable; "opened" is approximate.

4. **Voice message file size limits**
   - What we know: 60 seconds of Opus audio at 32kbps = ~240KB. At 64kbps = ~480KB. Very small compared to the existing 200MB media upload limit.
   - What's unclear: The optimal bitrate for voice messages in this app.
   - Recommendation: Use the browser default bitrate for MediaRecorder (typically 128kbps for Opus, producing ~960KB for 60s). This is well within B2 storage limits and provides excellent voice quality. No need to configure a custom bitrate.

## Sources

### Primary (HIGH confidence)
- [Socket.IO: How to use with Next.js](https://socket.io/how-to/use-with-nextjs) - Official custom server setup guide, version 4.x
- [Socket.IO: Rooms](https://socket.io/docs/v4/rooms/) - Room API, broadcasting, room joins
- [Socket.IO: Namespaces](https://socket.io/docs/v4/namespaces/) - Namespace isolation, multiplexing over single connection
- [Socket.IO: Middlewares](https://socket.io/docs/v4/middlewares/) - Auth middleware pattern, error handling
- [Socket.IO: Connection State Recovery](https://socket.io/docs/v4/connection-state-recovery) - v4.6.0+ feature, maxDisconnectionDuration, adapter compatibility
- [Socket.IO: JWT Authentication](https://socket.io/how-to/use-with-jwt) - Token extraction from handshake, manual JWT verification
- [Socket.IO: Cookie Handling](https://socket.io/how-to/deal-with-cookies) - Reading cookies from handshake headers
- [MDN: MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) - Browser native audio/video recording
- [Socket.IO npm: v4.8.3](https://www.npmjs.com/package/socket.io) - Latest stable version, Dec 2025
- Existing codebase analysis - `server.js`, `src/lib/auth/jwt.ts`, `src/lib/db/models/`, `src/lib/utils/cursor.ts`, `src/lib/email/`, `src/lib/moderation/profanity.ts`, `src/lib/storage/presign.ts`, `src/components/ui/Toast.tsx`
- [FreeLuma Pitfalls Research](/.planning/research/PITFALLS.md) - Socket.IO memory leak prevention, duplicate listener warnings

### Secondary (MEDIUM confidence)
- [Opus codec specification](https://opus-codec.org/) - Audio codec details, bitrate ranges
- [Safari WebKit: MediaRecorder API](https://webkit.org/blog/11353/mediarecorder-api/) - Safari support for MediaRecorder, codec compatibility
- [Build with Matija: iPhone Safari MediaRecorder](https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription) - Safari-specific MIME type detection
- [Better Stack: Node.js Schedulers Comparison](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) - node-cron vs BullMQ vs Bree comparison
- [node-cron npm](https://www.npmjs.com/package/node-cron) - API documentation, cron syntax
- [cookie npm](https://www.npmjs.com/package/cookie) - RFC 6265 cookie parsing

### Tertiary (LOW confidence)
- [Medium: MySQL schema for chat](https://medium.com/@mutationevent/mysql-schema-for-a-chat-application-7e0067dd04fd) - Chat DB schema patterns (adapted for this project's needs)
- [System Design: WhatsApp-like Messaging](https://systemdr.substack.com/p/designing-a-chat-system-storing-history) - Read receipt architecture, presence tracking patterns
- [Rekro: Email open tracking with pixel](https://www.rekro.in/2025/07/create-email-open-tracking-with-pixel.html) - Tracking pixel implementation approach

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Socket.IO 4.8.x is well-documented, official Next.js integration guide exists. All supporting libraries verified via npm.
- Architecture: HIGH - Patterns derived from official Socket.IO docs and existing codebase conventions. Room and namespace patterns are standard Socket.IO approaches.
- Database schema: HIGH - Based on well-established chat system design patterns, adapted to Sequelize/MySQL conventions already used in the project.
- Pitfalls: HIGH - Multiple pitfalls verified via official Socket.IO docs and project's own pitfalls research from Phase 0.
- Voice messages: MEDIUM - Browser API is well-documented, but Safari cross-browser edge cases require runtime feature detection. WebM/Opus support in Safari 18.4+ is relatively new.
- Email tracking: MEDIUM - Tracking pixel technique is well-known but accuracy is degraded by Apple Mail and Gmail proxying.

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (Socket.IO 4.x is stable; no major breaking changes expected)
