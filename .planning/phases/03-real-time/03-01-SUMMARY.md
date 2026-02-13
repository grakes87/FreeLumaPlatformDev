---
phase: "03-real-time"
plan: "01"
subsystem: "real-time-infrastructure"
tags: ["socket.io", "websocket", "presence", "auth-middleware", "react-context"]

dependency-graph:
  requires: ["01-03 (JWT auth)", "01-04 (AuthProvider)"]
  provides: ["Socket.IO server", "getIO() singleton", "authMiddleware", "presenceManager", "SocketProvider", "useSocket"]
  affects: ["03-02 (notifications DB)", "03-03 (notification service)", "03-05 (chat handlers)", "03-13 (integration)"]

tech-stack:
  added: ["socket.io@4.8.3", "socket.io-client@4.8.3", "cookie@1.1.1", "node-cron@3.0.3", "uuid@11.1.0", "@types/cookie", "@types/node-cron", "@types/uuid"]
  patterns: ["globalThis singleton for Socket.IO (mirrors Sequelize pattern)", "lazy namespace setup with idempotent guard", "cookie-based JWT auth for WebSocket", "dual-namespace separation (chat + notifications)"]

key-files:
  created:
    - "src/lib/socket/index.ts"
    - "src/lib/socket/auth.ts"
    - "src/lib/socket/presence.ts"
    - "src/context/SocketContext.tsx"
    - "src/hooks/useSocket.ts"
  modified:
    - "server.js"
    - "package.json"

decisions:
  - id: "server-js-inline-init"
    title: "Inline Socket.IO creation in server.js"
    choice: "server.js creates SocketServer directly, stores on globalThis.__io"
    rationale: "server.js is ESM .js and cannot import TypeScript files; TS code accesses io via globalThis"

  - id: "lazy-namespace-setup"
    title: "Lazy namespace setup in getIO()"
    choice: "Namespaces set up on first getIO() call with idempotent guard"
    rationale: "Handles dev HMR where module state resets but globalThis.__io persists; namespaces re-attach auth middleware correctly"

  - id: "dual-globalthis-guard"
    title: "Dual guard for namespace readiness"
    choice: "Both module-level namespacesReady and globalThis.__ioNamespacesReady"
    rationale: "Module variable handles production; globalThis variable handles dev HMR module re-evaluation"

metrics:
  duration: "4 min"
  completed: "2026-02-13"
---

# Phase 3 Plan 1: Socket.IO Infrastructure Summary

Socket.IO 4.8 server with dual namespaces (/chat, /notifications), cookie-based JWT auth middleware, in-memory presence tracking, and React SocketProvider context

## What Was Built

### Server-Side Infrastructure

**Socket.IO Server (server.js + src/lib/socket/index.ts)**
- server.js creates the SocketServer with connectionStateRecovery (2-min reconnect window) and stores on `globalThis.__io`
- Memory leak prevention: drops `rawSocket.request` after handshake to free large request objects
- `getIO()` reads from globalThis and lazily sets up namespaces (idempotent, HMR-safe)
- `initSocketServer()` available for programmatic init from compiled TypeScript

**Auth Middleware (src/lib/socket/auth.ts)**
- Extracts `auth_token` from HTTP cookie header using the `cookie` package
- Verifies JWT via existing `verifyJWT()` from `@/lib/auth/jwt`
- Attaches `socket.data.userId` and `socket.data.email` on success
- Returns authentication error to client on failure (no cookie, no token, invalid token)

**Presence Manager (src/lib/socket/presence.ts)**
- `Map<number, Set<string>>` tracking userId to Set of socketIds (multi-tab/device support)
- Methods: addUser, removeSocket (returns true if user went fully offline), isOnline, getOnlineUserIds, getOnlineStatusBulk, getOnlineCount, getSocketIds
- Singleton `presenceManager` exported for use across the application

**Namespace Setup**
- `/chat` namespace: auth middleware, presence tracking on connect/disconnect, user room join, presence:update broadcast
- `/notifications` namespace: auth middleware, user room join (`user:{userId}`) for targeted notification delivery

### Client-Side Context

**SocketProvider (src/context/SocketContext.tsx)**
- Connects to both `/chat` and `/notifications` namespaces when user is authenticated
- Auto-disconnects on logout or auth state change
- Reconnection config: 10 attempts, 1-10s exponential backoff
- Exposes `chatSocket`, `notifSocket`, `isConnected` via context

**useSocket Hook (src/hooks/useSocket.ts)**
- Re-exports `useSocket` from SocketContext for consistent `@/hooks/useSocket` import pattern

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- socket.io@4.8.3, socket.io-client@4.8.3, cookie@1.1.1, node-cron@3.0.3, uuid@11.1.0 installed
- TypeScript compilation passes for all new files (zero socket-related errors)
- server.js creates SocketServer and stores on globalThis.__io
- getIO() accessible from src/lib/socket/index.ts
- Auth middleware parses cookie and verifies JWT via verifyJWT
- PresenceManager tracks connections with multi-device support
- SocketProvider connects to both namespaces when authenticated

## Commits

| Hash | Message |
|------|---------|
| 2981301 | feat(03-01): Socket.IO server infrastructure with auth and presence |
| c5ee40b | feat(03-01): client-side SocketProvider and useSocket hook |

## Next Phase Readiness

Plan 03-01 provides the transport layer foundation. Subsequent plans depend on:
- **03-02**: Will create notifications/conversations DB schema (uses getIO for real-time delivery)
- **03-03**: Will create notification service (emits to /notifications namespace via getIO)
- **03-05**: Will register chat handlers on the /chat namespace connection event
- **03-13**: Will wrap app layout with SocketProvider for full integration

No blockers identified. node-cron and uuid installed proactively for later plans (03-03 notification scheduling, 03-04 conversation IDs).
