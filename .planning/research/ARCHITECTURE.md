# Architecture Research

**Domain:** Faith-based social platform (Next.js all-in-one)
**Researched:** 2026-02-11
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  React UI    │  │ Socket.IO    │  │  Agora SDK   │  │  Service   │  │
│  │  (App Router │  │  Client      │  │  (Video)     │  │  Worker    │  │
│  │   Pages)     │  │              │  │              │  │  (Push)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                 │                │         │
└─────────┼─────────────────┼─────────────────┼────────────────┼─────────┘
          │ HTTP/REST       │ WebSocket       │ WebRTC         │ Push API
          │                 │                 │                │
┌─────────┼─────────────────┼─────────────────┼────────────────┼─────────┐
│         ▼                 ▼                 │                ▼         │
│  ┌──────────────┐  ┌──────────────┐         │  ┌──────────────────┐   │
│  │  Next.js     │  │  Socket.IO   │         │  │  Web Push        │   │
│  │  API Routes  │  │  Server      │         │  │  Service         │   │
│  │  (REST)      │  │  (Real-time) │         │  │                  │   │
│  └──────┬───────┘  └──────┬───────┘         │  └──────────────────┘   │
│         │                 │                 │                         │
│         ▼                 ▼                 │                         │
│  ┌─────────────────────────────────┐        │   CUSTOM NODE SERVER    │
│  │       Service Layer             │        │   (server.js)           │
│  │  (Business Logic / Controllers) │        │                         │
│  └──────────────┬──────────────────┘        │                         │
│                 │                            │                         │
│         ┌───────┴───────┐                   │                         │
│         ▼               ▼                   │                         │
│  ┌────────────┐  ┌─────────────┐            │                         │
│  │ Sequelize  │  │ File System │            │                         │
│  │ ORM        │  │ (Uploads)   │            │                         │
│  └──────┬─────┘  └─────────────┘            │                         │
│         │                                    │                         │
└─────────┼────────────────────────────────────┼─────────────────────────┘
          │                                    │
          ▼                                    ▼
   ┌──────────────┐                     ┌──────────────┐
   │  MySQL /     │                     │  Agora Cloud  │
   │  MariaDB     │                     │  (Video SFU)  │
   └──────────────┘                     └──────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Custom Node Server** (`server.js`) | Boots Next.js + Socket.IO on a shared HTTP server. Single entry point for the entire application. | `createServer(handler)` with Socket.IO `Server` attached. Runs via `node server.js` in dev and production. |
| **Next.js App Router** (pages/layouts) | All UI rendering. Server Components for static content, Client Components for interactive elements. | `src/app/` directory with route groups `(auth)`, `(main)`, `(admin)`. Layouts handle nav shells. |
| **API Route Handlers** (`app/api/`) | REST endpoints for all CRUD operations. Stateless request-response. | `route.ts` files organized by resource: `app/api/posts/route.ts`, `app/api/posts/[id]/route.ts`. |
| **Socket.IO Server** | Real-time bidirectional events: chat messages, typing indicators, live notifications, workshop presence. | Initialized in `server.js`, event handlers in `src/lib/socket/` directory. Shares connected-user map. |
| **Sequelize ORM** | Database access layer. Model definitions, associations, migrations, seeders. | Singleton instance in `src/lib/db/`. Models in `src/lib/db/models/`. Connection pooling configured once. |
| **Auth Middleware** | JWT token verification on API routes and Socket.IO connections. | `middleware.ts` at project root for route protection. Helper functions for API route token validation. |
| **File Upload Handler** | Profile pictures, post media. Accepts multipart form data, stores to local filesystem. | Multer or native `formData()` API in route handlers. Files saved to `public/uploads/` with unique names. |
| **Agora Integration** | Live video workshops. Token generation server-side, SDK initialization client-side. | Server generates Agora RTC tokens via API route. Client uses Agora Web SDK with dynamic import (no SSR). |
| **Web Push Service** | Push notifications to subscribed browsers. | `web-push` library. Subscriptions stored in DB. Triggered by Socket.IO events or API actions. |
| **External Daily Content API** | Fetches daily Bible verses and positivity posts from `kindredsplendorapi.com`. | Server-side fetch with caching. Could be cron-triggered or on-demand with stale-while-revalidate. |

## Recommended Project Structure

```
freeluma/
├── server.js                    # Custom Node server (Next.js + Socket.IO)
├── next.config.js               # Next.js configuration
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── .env.local                   # Environment variables (secrets)
│
├── public/
│   ├── uploads/                 # User-uploaded files (profile pics, post media)
│   │   ├── avatars/
│   │   └── posts/
│   ├── icons/                   # App icons, favicon
│   └── sw.js                    # Service worker for push notifications
│
├── src/
│   ├── app/                     # -------- NEXT.JS APP ROUTER --------
│   │   ├── layout.tsx           # Root layout (<html>, <body>, providers)
│   │   ├── loading.tsx          # Global loading skeleton
│   │   ├── error.tsx            # Global error boundary
│   │   ├── not-found.tsx        # 404 page
│   │   │
│   │   ├── (auth)/              # Route group: unauthenticated pages
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx       # Auth layout (no nav bar)
│   │   │
│   │   ├── (main)/              # Route group: authenticated app shell
│   │   │   ├── layout.tsx       # Main layout (bottom tab nav, header)
│   │   │   ├── page.tsx         # Home / daily content
│   │   │   ├── feed/
│   │   │   │   └── page.tsx
│   │   │   ├── prayer-wall/
│   │   │   │   └── page.tsx
│   │   │   ├── post/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx # Single post view
│   │   │   │   └── create/
│   │   │   │       └── page.tsx
│   │   │   ├── categories/
│   │   │   │   ├── page.tsx     # Categories/groups listing
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── video-library/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── workshop/
│   │   │   │   ├── page.tsx     # Workshop listing
│   │   │   │   ├── create/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Live workshop room
│   │   │   ├── chat/
│   │   │   │   ├── page.tsx     # Chat list
│   │   │   │   └── [userId]/
│   │   │   │       └── page.tsx # Conversation thread
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx
│   │   │   ├── search/
│   │   │   │   └── page.tsx     # Search friends
│   │   │   ├── profile/
│   │   │   │   ├── page.tsx     # Own profile
│   │   │   │   ├── edit/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [userId]/
│   │   │   │       └── page.tsx # Other user's profile
│   │   │   ├── notes/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── bookmarks/
│   │   │   │   └── page.tsx
│   │   │   ├── daily-chapters/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/                 # -------- API ROUTE HANDLERS --------
│   │       ├── auth/
│   │       │   ├── login/
│   │       │   │   └── route.ts
│   │       │   ├── register/
│   │       │   │   └── route.ts
│   │       │   ├── forgot-password/
│   │       │   │   └── route.ts
│   │       │   └── me/
│   │       │       └── route.ts # GET current user from JWT
│   │       ├── posts/
│   │       │   ├── route.ts     # GET (list+feed), POST (create)
│   │       │   └── [id]/
│   │       │       ├── route.ts # GET, PUT, DELETE single post
│   │       │       ├── like/
│   │       │       │   └── route.ts
│   │       │       └── comments/
│   │       │           └── route.ts
│   │       ├── users/
│   │       │   ├── route.ts     # GET (search)
│   │       │   └── [id]/
│   │       │       ├── route.ts # GET profile
│   │       │       ├── follow/
│   │       │       │   └── route.ts
│   │       │       └── posts/
│   │       │           └── route.ts
│   │       ├── daily-posts/
│   │       │   └── route.ts     # GET today's content
│   │       ├── daily-chapters/
│   │       │   └── route.ts
│   │       ├── verses/
│   │       │   └── route.ts
│   │       ├── workshops/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── token/
│   │       │       │   └── route.ts  # Agora RTC token generation
│   │       │       └── invite/
│   │       │           └── route.ts
│   │       ├── chat/
│   │       │   ├── route.ts     # GET conversations list
│   │       │   └── [userId]/
│   │       │       └── route.ts # GET message history
│   │       ├── notifications/
│   │       │   └── route.ts
│   │       ├── notes/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       ├── bookmarks/
│   │       │   └── route.ts
│   │       ├── categories/
│   │       │   └── route.ts
│   │       ├── upload/
│   │       │   └── route.ts     # File upload endpoint
│   │       ├── push/
│   │       │   └── subscribe/
│   │       │       └── route.ts # Web push subscription
│   │       └── settings/
│   │           └── route.ts
│   │
│   ├── components/              # -------- SHARED UI COMPONENTS --------
│   │   ├── ui/                  # Primitive UI components (Button, Card, Input, Modal)
│   │   ├── layout/              # BottomNav, Header, Sidebar, AppShell
│   │   ├── feed/                # PostCard, PostComposer, CommentThread
│   │   ├── chat/                # ChatBubble, ChatInput, ConversationItem
│   │   ├── workshop/            # WorkshopCard, VideoGrid, WorkshopControls
│   │   ├── profile/             # ProfileHeader, StatsBar, AvatarInitials
│   │   ├── daily/               # DailyPostCard, VerseCard, ChapterPlayer
│   │   └── notifications/       # NotificationItem, NotificationBadge
│   │
│   ├── lib/                     # -------- SHARED LIBRARIES --------
│   │   ├── db/                  # Database layer
│   │   │   ├── index.ts         # Sequelize singleton instance + connection pool
│   │   │   ├── models/          # Sequelize model definitions
│   │   │   │   ├── index.ts     # Model registry + associations
│   │   │   │   ├── User.ts
│   │   │   │   ├── Post.ts
│   │   │   │   ├── Comment.ts
│   │   │   │   ├── Like.ts
│   │   │   │   ├── Follow.ts
│   │   │   │   ├── Chat.ts
│   │   │   │   ├── Notification.ts
│   │   │   │   ├── Workshop.ts
│   │   │   │   ├── WorkshopSeries.ts
│   │   │   │   ├── Note.ts
│   │   │   │   ├── Bookmark.ts
│   │   │   │   ├── Category.ts
│   │   │   │   ├── DailyPost.ts
│   │   │   │   ├── Verse.ts
│   │   │   │   ├── Video.ts
│   │   │   │   ├── PushSubscription.ts
│   │   │   │   └── Setting.ts
│   │   │   ├── migrations/      # Sequelize migration files
│   │   │   └── seeders/         # Seed data (categories, initial content)
│   │   │
│   │   ├── socket/              # Socket.IO server-side logic
│   │   │   ├── index.ts         # Socket initialization + event registration
│   │   │   ├── chatHandlers.ts  # Chat message events
│   │   │   ├── notificationHandlers.ts
│   │   │   └── workshopHandlers.ts
│   │   │
│   │   ├── auth/                # Authentication utilities
│   │   │   ├── jwt.ts           # Sign, verify, decode tokens
│   │   │   ├── password.ts      # bcrypt hash and compare
│   │   │   └── middleware.ts    # API route auth wrapper
│   │   │
│   │   ├── agora/               # Agora integration
│   │   │   └── tokenBuilder.ts  # RTC token generation
│   │   │
│   │   ├── push/                # Web push notifications
│   │   │   └── index.ts         # web-push library wrapper
│   │   │
│   │   ├── upload/              # File upload utilities
│   │   │   └── index.ts         # File validation, naming, storage
│   │   │
│   │   └── utils/               # General utilities
│   │       ├── api.ts           # API response helpers, error formatting
│   │       ├── validation.ts    # Input validation schemas
│   │       └── constants.ts     # App-wide constants
│   │
│   ├── hooks/                   # -------- CLIENT-SIDE HOOKS --------
│   │   ├── useAuth.ts           # Auth state, login/logout
│   │   ├── useSocket.ts         # Socket.IO connection management
│   │   ├── useChat.ts           # Chat state + socket events
│   │   ├── useNotifications.ts  # Notification state + real-time updates
│   │   └── useWorkshop.ts       # Workshop room state + Agora
│   │
│   ├── context/                 # -------- REACT CONTEXT --------
│   │   ├── AuthContext.tsx       # Auth state provider
│   │   ├── SocketContext.tsx     # Socket.IO connection provider
│   │   └── ThemeContext.tsx      # Light/dark/system theme
│   │
│   ├── socket.ts                # Socket.IO client instance (singleton)
│   │
│   └── styles/                  # -------- GLOBAL STYLES --------
│       └── globals.css          # Tailwind directives + custom CSS
│
└── .sequelizerc                 # Sequelize CLI paths configuration
```

### Structure Rationale

- **`server.js` at project root:** Required for the custom Node server that boots both Next.js and Socket.IO on a shared HTTP server. This file runs outside the Next.js bundler and must be compatible with the runtime Node.js version directly.

- **`src/app/(auth)/` and `src/app/(main)/` route groups:** Separates unauthenticated pages (login, register) from the authenticated app shell. Each group gets its own layout -- the auth group has no navigation chrome, while the main group wraps pages with the bottom tab bar and header. This is a Next.js convention that does not affect URLs.

- **`src/app/api/` organized by resource:** Each API resource (posts, users, workshops) gets its own folder with nested `route.ts` files. Sub-resources like `posts/[id]/comments/route.ts` mirror REST conventions. This keeps API routes discoverable and matches the URL structure.

- **`src/lib/` for server-only shared code:** Database models, auth utilities, Socket.IO handlers, and Agora token generation all live here. These are imported by API routes and `server.js` but never by client components. The `lib/` directory is the canonical Next.js convention for shared utilities.

- **`src/components/` organized by feature domain:** Rather than a flat list of components, grouping by domain (feed, chat, workshop, profile) keeps related UI together and makes it clear which components belong to which feature. Shared primitives go in `ui/`.

- **`src/hooks/` and `src/context/` for client state:** Custom hooks encapsulate Socket.IO subscriptions, auth state, and feature-specific logic. Context providers wrap the app at the layout level for auth and socket state that many components need.

## Architectural Patterns

### Pattern 1: Custom Server with Socket.IO Attached

**What:** A single `server.js` file creates an HTTP server, passes it to Next.js for request handling, and attaches Socket.IO to the same server for WebSocket connections. Both share port 3000 (or whatever port is configured).

**When to use:** Any Next.js app that needs persistent WebSocket connections on a self-hosted server. This is the only viable pattern when deploying to a VPS (not serverless).

**Trade-offs:**
- PRO: Single deployment unit, single port, simpler infrastructure
- PRO: Socket.IO server can import the same Sequelize models and business logic as API routes
- CON: Loses Automatic Static Optimization and serverless function isolation
- CON: Cannot use `output: 'standalone'` mode (custom server is not traced)

**Example:**
```typescript
// server.js
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { initializeSocket } from "./src/lib/socket/index.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || "*" },
  });

  initializeSocket(io);

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
```

**Confidence:** HIGH -- This pattern is documented in the official Socket.IO guide for Next.js and confirmed by the Next.js custom server documentation.

### Pattern 2: Singleton Sequelize Instance with Connection Pooling

**What:** A single Sequelize instance is created once and reused across all API routes and Socket.IO handlers. In development, the instance is cached on `globalThis` to survive hot module reloading.

**When to use:** Always, for any Next.js app using Sequelize. Without this, each API route invocation could create a new database connection.

**Trade-offs:**
- PRO: Efficient connection reuse, predictable pool behavior
- PRO: All models and associations defined once
- CON: Must be careful with development hot-reload (globalThis caching pattern)

**Example:**
```typescript
// src/lib/db/index.ts
import { Sequelize } from "sequelize";

const globalForSequelize = globalThis as unknown as {
  sequelize: Sequelize | undefined;
};

export const sequelize =
  globalForSequelize.sequelize ??
  new Sequelize(
    process.env.DB_NAME!,
    process.env.DB_USER!,
    process.env.DB_PASSWORD!,
    {
      host: process.env.DB_HOST,
      dialect: "mysql",
      pool: {
        max: 10,
        min: 2,
        acquire: 30000,
        idle: 10000,
      },
      logging: process.env.NODE_ENV === "development" ? console.log : false,
    }
  );

if (process.env.NODE_ENV !== "production") {
  globalForSequelize.sequelize = sequelize;
}
```

**Confidence:** HIGH -- Sequelize connection pooling is well-documented. The globalThis caching pattern is the standard approach used by Prisma and other ORMs in Next.js.

### Pattern 3: API Route Auth Wrapper

**What:** A higher-order function that wraps API route handlers to extract and verify the JWT token from the `Authorization` header before the handler executes.

**When to use:** Every authenticated API endpoint. The wrapper returns 401 if the token is missing or invalid, and injects the decoded user into the handler context.

**Trade-offs:**
- PRO: DRY authentication logic, consistent error responses
- PRO: Type-safe user object available in every handler
- CON: Additional function wrapping on every route (minimal overhead)

**Example:**
```typescript
// src/lib/auth/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./jwt";

type AuthHandler = (
  req: NextRequest,
  context: { params: any; user: { id: number; email: string } }
) => Promise<NextResponse>;

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest, context: { params: any }) => {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    return handler(req, { ...context, user });
  };
}
```

**Confidence:** HIGH -- This pattern is standard across Next.js API route authentication implementations.

### Pattern 4: Socket.IO with Namespace Separation

**What:** Organize Socket.IO events into namespaces (or at minimum, separate handler modules) for chat, notifications, and workshops. Each namespace has its own connection logic and event handlers.

**When to use:** When the Socket.IO server handles multiple distinct real-time features that should not interfere with each other.

**Trade-offs:**
- PRO: Clean separation of concerns, independent scaling paths
- PRO: Different auth or middleware per namespace
- CON: More connection overhead per client if using multiple namespaces (one WebSocket per namespace)
- ALTERNATIVE: Use a single namespace with event-name prefixes (`chat:send`, `notify:new`) for simpler apps

**Recommendation for Free Luma:** Start with a single default namespace and prefixed event names. The user base (~10K) does not warrant namespace separation overhead. Organize server-side code into separate handler files regardless.

**Confidence:** MEDIUM -- Namespace separation is well-documented, but the recommendation for Free Luma's scale is an architectural judgment.

### Pattern 5: Agora SDK with Dynamic Import

**What:** Import the Agora Web SDK only on the client side using `next/dynamic` with `ssr: false`, because Agora accesses the `window` object which is not available during server-side rendering.

**When to use:** Any Next.js page that renders Agora video elements.

**Trade-offs:**
- PRO: Prevents SSR crashes from browser-only APIs
- PRO: Reduces initial bundle size (Agora SDK is large)
- CON: Workshop page has a loading delay while SDK loads

**Example:**
```typescript
// src/app/(main)/workshop/[id]/page.tsx
import dynamic from "next/dynamic";

const WorkshopRoom = dynamic(
  () => import("@/components/workshop/WorkshopRoom"),
  { ssr: false, loading: () => <WorkshopSkeleton /> }
);

export default function WorkshopPage({ params }: { params: { id: string } }) {
  return <WorkshopRoom workshopId={params.id} />;
}
```

**Confidence:** HIGH -- Agora's own documentation explicitly recommends dynamic import for Next.js.

## Data Flow

### Request Flow (REST API)

```
[User Action in Browser]
    │
    ▼
[Client Component] ──fetch()──▶ [API Route Handler]  (src/app/api/...)
                                       │
                                       ▼
                                [Auth Middleware]  (withAuth wrapper)
                                       │
                                       ▼ (user context injected)
                                [Business Logic]  (inline or service function)
                                       │
                                       ▼
                                [Sequelize Model]  (src/lib/db/models/...)
                                       │
                                       ▼
                                [MySQL Database]
                                       │
                                       ▼ (query result)
                                [JSON Response] ──────▶ [Client State Update]
```

### Real-Time Chat Flow

```
[User A types message]
    │
    ▼
[ChatInput Component] ──socket.emit("send-message")──▶ [Socket.IO Server]
                                                              │
                                                              ▼
                                                    [chatHandlers.ts]
                                                              │
                                                    ┌─────────┴──────────┐
                                                    ▼                    ▼
                                            [Sequelize: save       [Find receiver
                                             message to DB]         socket ID from
                                                    │                connectedUsers]
                                                    ▼                    │
                                            [Return saved msg]          ▼
                                                    │         io.to(receiverId)
                                                    │           .emit("receive-message")
                                                    │                    │
                                                    ▼                    ▼
                                        socket.emit(              [User B's ChatView
                                         "sent-acknowledge")       receives message
                                                │                  via useSocket hook]
                                                ▼
                                        [User A sees
                                         sent confirmation]
```

### Notification Flow

```
[Triggering Action]  (like, comment, follow, workshop invite)
    │
    ▼
[API Route Handler]
    │
    ├──▶ [Save notification to DB]  (Notification model)
    │
    └──▶ [Get Socket.IO instance]  (getIoInstance())
              │
              ▼
         [Emit to target user]  io.to(targetSocketId).emit("new-notification")
              │
              ├──▶ [Client: useNotifications hook]  ──▶ [Update badge count]
              │
              └──▶ [Optional: Web Push]  (if user offline / subscribed)
                         │
                         ▼
                    [web-push library sends to browser push service]
                         │
                         ▼
                    [Service Worker shows native notification]
```

### Workshop (Live Video) Flow

```
[Host creates workshop]
    │
    ▼
[API: POST /api/workshops]  ──▶ [Save WorkshopSeries + Workshop to DB]
                                       │
                                       ▼
                                [Generate Agora channel name / meeting ID]
    │
    ▼
[Users navigate to /workshop/[id]]
    │
    ▼
[Client: fetch /api/workshops/[id]/token]  ──▶ [Server generates Agora RTC token]
    │                                                  │
    ▼                                                  ▼
[Agora SDK: join channel with token]          [Return token + channel info]
    │
    ▼
[WebRTC media streams managed by Agora cloud servers]
    │
    ├──▶ [Socket.IO: workshop presence events]  (user-joined, user-left)
    │
    └──▶ [Socket.IO: workshop chat messages]  (in-workshop text chat)
```

### Daily Content Flow

```
[User opens app / home page]
    │
    ▼
[Server Component or Client fetch]
    │
    ▼
[API: GET /api/daily-posts]
    │
    ├──▶ [Check cache / DB for today's content]
    │         │
    │         ▼  (if stale or missing)
    │    [Fetch from kindredsplendorapi.com]
    │         │
    │         ▼
    │    [Cache response in DB]
    │
    ▼
[Return daily post data]  (verse, positivity post, chapter)
    │
    ▼
[DailyPostCard / VerseCard renders content]
```

### Key Data Flows

1. **Authentication flow:** Client sends credentials to `/api/auth/login`. Server verifies with bcrypt, issues JWT. Client stores JWT in HttpOnly cookie or memory. All subsequent API requests include `Authorization: Bearer <token>`. Socket.IO connection sends token in handshake auth for server-side verification.

2. **Feed pagination flow:** Client requests `/api/posts?page=1&limit=20&sort=newest`. Server queries Posts table with user follow-based filtering, joins User for author info, returns paginated JSON. Client renders PostCard list with infinite scroll triggering next page fetch.

3. **File upload flow:** Client sends `FormData` to `/api/upload`. API route parses multipart body (disabled default body parser), validates file type/size, generates unique filename, writes to `public/uploads/`, returns file URL path. URL is then included in the post or profile update payload.

## Database Schema Organization

### Schema Domains

The database tables fall into six logical domains. Each domain should be built together because of internal foreign key dependencies.

```
┌──────────────────────────────────────────────────────────────────┐
│                     DOMAIN 1: IDENTITY                           │
│  users, settings (per-user prefs live on users table)            │
│  app_settings (global key-value config)                          │
└──────────────────────┬───────────────────────────────────────────┘
                       │ user_id FK
┌──────────────────────▼───────────────────────────────────────────┐
│                     DOMAIN 2: SOCIAL GRAPH                       │
│  follows (follower_id → users, following_id → users)             │
│  categories, category_user_relations                             │
└──────────────────────┬───────────────────────────────────────────┘
                       │ user_id FK
┌──────────────────────▼───────────────────────────────────────────┐
│                     DOMAIN 3: CONTENT                            │
│  posts (user_id, category_id, post_type ENUM)                    │
│  comments (post_id, user_id, parent_id for nesting)              │
│  likes (user_id, likeable_id, likeable_type — polymorphic)       │
│  bookmarks (user_id, bookmarkable_id, bookmarkable_type)         │
│  notes (user_id, private content)                                │
└──────────────────────┬───────────────────────────────────────────┘
                       │ user_id FK
┌──────────────────────▼───────────────────────────────────────────┐
│                     DOMAIN 4: DAILY CONTENT                      │
│  daily_posts (fetched from external API, cached)                 │
│  verses (verse_name, engagement counts)                          │
│  daily_chapters (user_id, chapter tracking)                      │
│  daily_post_comments, verse_comments (engagement)                │
└──────────────────────┬───────────────────────────────────────────┘
                       │ user_id FK
┌──────────────────────▼───────────────────────────────────────────┐
│                     DOMAIN 5: REAL-TIME                           │
│  chats (sender_id, receiver_id, message, message_type)           │
│  notifications (user_id, type, action_done_by, polymorphic refs) │
│  push_subscriptions (user_id, subscription JSON)                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │ user_id FK
┌──────────────────────▼───────────────────────────────────────────┐
│                     DOMAIN 6: WORKSHOPS                          │
│  workshop_series (topic, schedule, created_by, meeting_id)       │
│  workshops (series_id, date, start_time, end_time)               │
│  workshop_invitations (workshop_id, user_id, status)             │
│  workshop_interests (workshop_id, user_id)                       │
│  workshop_logs (activity tracking)                               │
└──────────────────────────────────────────────────────────────────┘
```

### Schema Improvements Over Old Codebase

The old codebase has several schema patterns that should be corrected in the rewrite:

| Old Pattern | Problem | New Pattern |
|-------------|---------|-------------|
| `liked_posts` JSON array on users table | Cannot index, grows unbounded, no referential integrity | Separate `likes` junction table with `user_id` + `likeable_id` + `likeable_type` |
| Separate comment tables per content type (dailyPostComments, verseComments, dailyPostUserComments, verseUserComments) | 6+ tables doing the same thing with different FKs | Single `comments` table with `commentable_id` + `commentable_type` polymorphic pattern |
| Denormalized count fields (likes_count, comments_count, followers_count on parent tables) | Drift risk if not atomically updated | Keep counts but update via Sequelize hooks or DB triggers for consistency. Alternatively, compute on read for small scale. |
| `is_deleted` soft-delete boolean | Acceptable pattern, but inconsistent naming (some tables use `deleted`, others `is_deleted`) | Standardize on `deleted_at` DATETIME (null means active). Enables "deleted when" queries. |
| `blocked_users` JSON array on workshops table | Cannot query "which workshops is user X blocked from" efficiently | Separate `workshop_blocked_users` junction table |
| Notification model with many nullable polymorphic FKs (comment_id, daily_post_comment_id, chat_id, workshop_id, workshop_invitation_id) | Sparse columns, hard to extend | Single `reference_id` + `reference_type` polymorphic pattern on notifications |

### Recommended Core Tables (Consolidated)

```
users
  id, first_name, last_name, username, email, password_hash,
  profile_picture, bio, city, state, country, phone, dob,
  account_visibility (PUBLIC/PRIVATE), language (en/es),
  notification_preferences (JSON), theme_preference,
  deleted_at, created_at, updated_at

follows
  id, follower_id (→users), following_id (→users),
  status (PENDING/ACCEPTED/REJECTED),
  created_at, updated_at
  UNIQUE(follower_id, following_id)

posts
  id, user_id (→users), category_id (→categories),
  text_content, post_type (FEED/PRAYER_WALL),
  media (JSON array of file paths),
  likes_count, comments_count, shares_count,
  deleted_at, created_at, updated_at

comments
  id, user_id (→users),
  commentable_id, commentable_type (POST/DAILY_POST/VERSE),
  parent_id (→comments, nullable, for threading),
  text_content, likes_count,
  deleted_at, created_at, updated_at

likes
  id, user_id (→users),
  likeable_id, likeable_type (POST/COMMENT/DAILY_POST/VERSE),
  created_at
  UNIQUE(user_id, likeable_id, likeable_type)

bookmarks
  id, user_id (→users),
  bookmarkable_id, bookmarkable_type (POST/VERSE/DAILY_POST),
  created_at
  UNIQUE(user_id, bookmarkable_id, bookmarkable_type)

categories
  id, category_name, created_at, updated_at

category_users
  id, user_id (→users), category_id (→categories),
  created_at

chats
  id, sender_id (→users), receiver_id (→users),
  message, message_type (TEXT/IMAGE/VIDEO/AUDIO),
  media, is_seen,
  created_at, updated_at

notifications
  id, user_id (→users), action_done_by (→users),
  notification_type (FOLLOW/LIKE/COMMENT/CHAT/WORKSHOP/SYSTEM),
  reference_id, reference_type,
  is_seen, created_at

notes
  id, user_id (→users),
  title, content, note_type (TEXT/AUDIO),
  voice_audio,
  deleted_at, created_at, updated_at

daily_posts
  id, daily_post_name, content_data (JSON, cached from external API),
  language, post_date,
  likes_count, comments_count,
  created_at, updated_at

verses
  id, verse_name, translation,
  likes_count, comments_count,
  created_at, updated_at

daily_chapters
  id, user_id (→users), chapter_name,
  listen_time, is_completed,
  created_at, updated_at

videos
  id, video_date, duration, thumbnail_name,
  deleted_at, created_at, updated_at

video_user_progress
  id, user_id (→users), video_id (→videos),
  listen_time, is_completed,
  created_at, updated_at

workshop_series
  id, created_by (→users), category_id (→categories),
  topic_name, language, age_restriction,
  recurring_schedule, study_visibility (PUBLIC/PRIVATE),
  meeting_id, denomination,
  created_at, updated_at

workshops
  id, series_id (→workshop_series),
  date, start_time, end_time, force_ended,
  created_at, updated_at

workshop_invitations
  id, workshop_id (→workshops), user_id (→users),
  status (PENDING/ACCEPTED/REJECTED),
  created_at, updated_at

workshop_participants
  id, workshop_id (→workshops), user_id (→users),
  joined_at, left_at

push_subscriptions
  id, user_id (→users), subscription (JSON),
  created_at, updated_at

app_settings
  id, key_name, value, created_at, updated_at

homescreen_tile_categories
  id, name, sort_order, created_at, updated_at
```

### Key Indexes

```
-- Feed query performance
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_type_created ON posts(post_type, created_at DESC);
CREATE INDEX idx_posts_category ON posts(category_id);

-- Social graph lookups
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE UNIQUE INDEX idx_follows_pair ON follows(follower_id, following_id);

-- Polymorphic lookups
CREATE INDEX idx_comments_commentable ON comments(commentable_type, commentable_id);
CREATE INDEX idx_likes_likeable ON likes(likeable_type, likeable_id);
CREATE UNIQUE INDEX idx_likes_unique ON likes(user_id, likeable_id, likeable_type);

-- Chat performance
CREATE INDEX idx_chats_participants ON chats(sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_chats_receiver ON chats(receiver_id, is_seen);

-- Notification inbox
CREATE INDEX idx_notifications_user ON notifications(user_id, is_seen, created_at DESC);

-- Daily content lookups
CREATE INDEX idx_daily_chapters_user ON daily_chapters(user_id, created_at DESC);
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current architecture is more than sufficient. Single VPS (2-4 vCPU, 4-8GB RAM) running Node.js + MySQL on the same machine. Connection pool of 5-10 is fine. No caching layer needed. |
| 1k-10k users (current scale) | Same single-server architecture. Increase connection pool to 10-20. Add Redis for Socket.IO adapter (if horizontal scaling becomes necessary) and for caching daily content API responses. Consider separating MySQL to its own server. Monitor slow queries with Sequelize logging. |
| 10k-100k users | Add a reverse proxy (Nginx) in front of Node.js for static file serving, SSL termination, and rate limiting. Move file uploads to object storage (MinIO self-hosted or S3). Add Redis as a required component for session store and Socket.IO adapter. Consider horizontal Node.js scaling with PM2 cluster mode. |
| 100k+ users | Beyond the current project scope. Would require: dedicated message queue for notifications, read replicas for MySQL, CDN for static assets, horizontal Socket.IO with Redis adapter, separate microservices for chat and workshops. |

### Scaling Priorities

1. **First bottleneck: Database queries.** The feed query (fetching posts from followed users) will be the first to slow down as user count grows. Index the `follows` table and the `posts(user_id, created_at)` columns. Use cursor-based pagination instead of OFFSET for deep pages.

2. **Second bottleneck: Socket.IO memory.** The in-memory `connectedUsers` Map grows linearly with active users. At 10K+ concurrent connections, move to Redis adapter for Socket.IO to enable multi-process and multi-server scaling.

3. **Third bottleneck: File storage.** Uploaded profile pictures and post media stored on local filesystem will consume disk space. Plan migration path to object storage when disk approaches capacity.

## Anti-Patterns

### Anti-Pattern 1: Importing Sequelize Models in Client Components

**What people do:** Import models from `src/lib/db/models/` in a React component marked `"use client"`.
**Why it's wrong:** Sequelize and database credentials get bundled into the client JavaScript. Build fails or exposes secrets.
**Do this instead:** Always access data through API routes (`fetch('/api/...')`). Only `src/lib/` code should import models, and only in server-side contexts (API routes, server components, Socket.IO handlers).

### Anti-Pattern 2: Creating Sequelize Instances Per Request

**What people do:** Call `new Sequelize(...)` inside an API route handler.
**Why it's wrong:** Each request opens a new connection pool, exhausting MySQL's `max_connections` within seconds under load.
**Do this instead:** Use the singleton pattern (Pattern 2 above). One Sequelize instance per process, cached on `globalThis` in development.

### Anti-Pattern 3: Storing JWT in localStorage

**What people do:** Save the JWT token to `localStorage` and read it on every request.
**Why it's wrong:** Vulnerable to XSS attacks. Any script injection can steal the token.
**Do this instead:** Store JWT in an HttpOnly, Secure, SameSite cookie. The browser automatically sends it with every request. For Socket.IO handshake, read the token from the cookie on the server side.

### Anti-Pattern 4: Putting Business Logic in Socket.IO Event Handlers

**What people do:** Write database queries and validation directly inside `socket.on("event", ...)` callbacks.
**Why it's wrong:** Logic becomes untestable, unreusable, and duplicated between REST and real-time paths.
**Do this instead:** Extract business logic into service functions in `src/lib/`. Both API routes and Socket.IO handlers call the same service functions.

### Anti-Pattern 5: Using `output: 'standalone'` with a Custom Server

**What people do:** Set `output: 'standalone'` in `next.config.js` while using a custom `server.js`.
**Why it's wrong:** Standalone mode generates its own minimal `server.js`. The Next.js docs explicitly state: "When using standalone output mode, it does not trace custom server files. This mode outputs a separate minimal server.js file, instead. These cannot be used together."
**Do this instead:** Omit the `output` config or use default. Deploy the full project directory on the VPS. Use PM2 or systemd to run `node server.js`.

### Anti-Pattern 6: Fetching External API on Every Page Load

**What people do:** Call `kindredsplendorapi.com` for daily content on every user request.
**Why it's wrong:** Adds latency to every page load, risks rate limiting from external API, and the content only changes once per day.
**Do this instead:** Fetch daily content once per day (via cron job or first-request-of-day trigger), cache in the `daily_posts` table, serve from local DB for all subsequent requests.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Agora Cloud** (video) | Client-side SDK connects to Agora servers. Server generates RTC tokens via Agora's `agora-access-token` npm package. | Tokens are short-lived and channel-specific. Generate one per user per workshop session. Dynamic import required on client to avoid SSR issues. |
| **kindredsplendorapi.com** (daily content) | Server-side HTTP fetch from API routes or cron job. JSON response cached in MySQL. | External dependency -- if it goes down, serve cached content from previous day. Add timeout and retry logic. |
| **Email gateway** (SMTP/SendGrid) | Server-side only. Triggered by auth flows (registration confirmation, password reset) and optional notification emails. | Use `nodemailer` with SMTP or a provider SDK. Queue emails asynchronously to avoid blocking API responses. |
| **SMS gateway** (Twilio/similar) | Server-side only. Triggered by optional SMS notifications. | Lower priority integration. Same async pattern as email. |
| **Web Push service** (browser push APIs) | `web-push` npm package on server. Browser Push API + Service Worker on client. | Subscription object stored in `push_subscriptions` table. Server sends push when Socket.IO delivery fails (user offline). |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Client Components ↔ API Routes** | HTTP `fetch()` with JWT in cookies or Authorization header | All data mutations go through REST API. No direct DB access from client. |
| **Client Components ↔ Socket.IO** | WebSocket via `socket.io-client` singleton | Real-time events only: chat messages, typing indicators, new notifications, workshop presence. Not for data fetching. |
| **API Routes ↔ Database** | Sequelize ORM method calls | API routes import models from `src/lib/db/models/`. All queries go through Sequelize, never raw SQL unless for complex aggregations. |
| **API Routes ↔ Socket.IO** | Shared `getIoInstance()` function | When an API route action should trigger a real-time event (e.g., new like triggers notification), the route handler calls `getIoInstance().to(targetSocketId).emit(...)`. |
| **Socket.IO Handlers ↔ Database** | Same Sequelize models | Socket handlers (e.g., saving a chat message) import the same model layer. Shared business logic in `src/lib/` service functions. |
| **Next.js Middleware ↔ API Routes** | Request interception at edge | `middleware.ts` at project root handles route protection (redirect unauthenticated users to login). Does NOT replace per-route JWT verification in API handlers. |

## Build Order (Dependency Chain)

The following build order respects internal dependencies -- each phase uses components from previous phases.

```
Phase 1: Foundation
  ├── Custom server (server.js) + Next.js boot
  ├── Sequelize connection + core models (User)
  ├── JWT auth (register, login, middleware)
  └── Basic layout shell (App Router structure, (auth)/(main) route groups)
  DEPENDS ON: Nothing. This is the base.

Phase 2: Core Social
  ├── Post model + CRUD API routes
  ├── Comment model + API routes
  ├── Like model + API routes
  ├── Follow model + API routes
  ├── Feed page (with pagination)
  ├── Post detail page
  ├── Profile page (own + other users)
  ├── Search/discover users
  └── File upload (for post media + profile pictures)
  DEPENDS ON: Phase 1 (auth, user model, layout shell)

Phase 3: Real-Time
  ├── Socket.IO initialization on custom server
  ├── Socket.IO client provider (context + hooks)
  ├── Chat model + API routes (history)
  ├── Chat UI (conversation list, message thread)
  ├── Real-time chat events (send, receive, typing)
  ├── Notification model + API routes
  ├── Real-time notification delivery
  └── Notification UI (badge + list page)
  DEPENDS ON: Phase 1 (auth, server), Phase 2 (follow model for "who to notify")

Phase 4: Daily Content & Categories
  ├── Daily post model + external API fetch + caching
  ├── Verse model + display
  ├── Daily chapter model + tracking
  ├── Category model + assignment
  ├── Home page with daily content cards
  ├── Category browsing page
  ├── Prayer wall (filtered feed by post_type)
  └── Bookmarks model + API + UI
  DEPENDS ON: Phase 1 (auth), Phase 2 (posts/comments used by daily content)

Phase 5: Workshops & Video
  ├── Workshop series + workshop models + API routes
  ├── Workshop creation / scheduling UI
  ├── Agora token generation API route
  ├── Workshop room page (dynamic Agora import)
  ├── Workshop invitation model + API + UI
  ├── Workshop presence via Socket.IO
  ├── Video library model + listing page
  └── Video progress tracking
  DEPENDS ON: Phase 1 (auth), Phase 3 (Socket.IO for presence), Phase 2 (categories)

Phase 6: Notes, Settings, Polish
  ├── Notes model + CRUD API + UI
  ├── Settings page (appearance, notifications, account)
  ├── Web push notification subscription + service worker
  ├── Dark mode / system theme toggle
  ├── i18n (English/Spanish)
  ├── Email integration (password reset, welcome)
  └── Data migration from old platform
  DEPENDS ON: All previous phases operational
```

### Build Order Rationale

- **Foundation first** because every other feature needs auth and database access.
- **Core Social before Real-Time** because chat and notifications reference users, posts, and follows. You cannot notify about a like if the like system does not exist yet.
- **Real-Time before Workshops** because workshops use Socket.IO for presence and in-workshop chat.
- **Daily Content can parallel with Real-Time** (Phase 3 and 4 are somewhat independent), but both depend on Phase 2.
- **Workshops last among features** because they have the most dependencies (auth, categories, Socket.IO, Agora) and the most complexity.
- **Notes, Settings, Polish last** because they are leaf features with no downstream dependents.

## Sources

- [Socket.IO: How to use with Next.js](https://socket.io/how-to/use-with-nextjs) -- Official guide for custom server + App Router integration (HIGH confidence)
- [Next.js Docs: Custom Server](https://nextjs.org/docs/pages/guides/custom-server) -- Official caveats and setup for custom servers (HIGH confidence)
- [Next.js Docs: Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) -- Official folder conventions and organization patterns (HIGH confidence)
- [Next.js Blog: Building APIs](https://nextjs.org/blog/building-apis-with-nextjs) -- Official API route patterns (HIGH confidence)
- [Sequelize Docs: Connection Pool](https://sequelize.org/docs/v6/other-topics/connection-pool/) -- Official connection pooling configuration (HIGH confidence)
- [Agora Docs: Interactive Live Streaming](https://docs.agora.io/en/interactive-live-streaming/get-started/get-started-sdk) -- Official SDK integration guide (HIGH confidence)
- [Agora Blog: Next.js Video Call App](https://www.agora.io/en/blog/build-a-next-js-video-call-app/) -- Dynamic import pattern for SSR compatibility (HIGH confidence)
- [GeeksforGeeks: Database Design for Social Media Platform](https://www.geeksforgeeks.org/sql/how-to-design-database-for-social-media-platform/) -- Schema patterns reference (MEDIUM confidence)
- [Tutorials24x7: Database for Social Network in MySQL](https://mysql.tutorials24x7.com/blog/guide-to-design-database-for-social-network-system-in-mysql) -- MySQL-specific schema patterns (MEDIUM confidence)
- Old codebase analysis: `/Old Code/FreeLumaDev-new/free-luma-api/src/models/` -- 30+ Sequelize model files examined for existing schema understanding (HIGH confidence, primary source)

---
*Architecture research for: Free Luma faith-based social platform*
*Researched: 2026-02-11*
