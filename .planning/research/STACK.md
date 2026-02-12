# Stack Research

**Domain:** Faith-based social platform with real-time features
**Project:** Free Luma
**Researched:** 2026-02-11
**Confidence:** HIGH (core stack verified via official docs and npm; supporting libraries verified via multiple sources)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js (App Router)** | 16.1.x | Full-stack framework (SSR, API routes, routing) | All-in-one: server components, API routes, file-based routing, image optimization. Self-hosting is first-class with `output: 'standalone'`. Turbopack is now default bundler (2-5x faster builds). Released Oct 2025. **Confidence: HIGH** (verified via [official blog](https://nextjs.org/blog/next-16)). |
| **React** | 19.2.x | UI library | Ships with Next.js 16. View Transitions, `useEffectEvent()`, `<Activity/>` for background rendering. React Compiler stable for auto-memoization. **Confidence: HIGH** (bundled with Next.js 16). |
| **MySQL/MariaDB** | 8.0+ / 10.6+ | Relational database | Already installed via XAMPP. Reliable for structured social data (users, posts, comments, prayers). Strong indexing for feed queries. Free, self-hosted, battle-tested. **Confidence: HIGH** (project requirement). |
| **Sequelize ORM** | 6.37.x | Database ORM | Stable, mature ORM with full MySQL/MariaDB support. Model-based approach maps well to social platform entities. Migrations, associations, transactions all built-in. v7 is still alpha -- not production-ready. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/sequelize), [official docs](https://sequelize.org/)). |
| **Socket.IO** | 4.8.x (server) / 4.8.x (client) | Real-time communication | Mature WebSocket library with automatic fallback to long-polling. Built-in rooms/namespaces map perfectly to chat channels and prayer wall updates. Works with Next.js custom server pattern. **Confidence: HIGH** (verified via [official Socket.IO + Next.js guide](https://socket.io/how-to/use-with-nextjs)). |
| **Agora Web SDK** | 4.24.x (`agora-rtc-sdk-ng`) | Live video workshops | WebRTC-based SDK for live video/audio. Handles complex video infrastructure (TURN/STUN, SFU). Free tier: 10,000 minutes/month. No self-hosted video infrastructure needed. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/agora-rtc-sdk-ng), [Agora docs](https://docs.agora.io/en/sdks)). |
| **Tailwind CSS** | 4.1.x | Utility-first CSS | v4.0 is a ground-up rewrite: 5x faster full builds, 100x faster incremental builds. Zero-config with automatic content detection. CSS-native approach with `@property` and cascade layers. Perfect for mobile-first card-based UI. **Confidence: HIGH** (verified via [official site](https://tailwindcss.com/), [npm](https://www.npmjs.com/package/tailwindcss)). |
| **TypeScript** | 5.x | Type safety | Required by Next.js 16 (minimum 5.1.0). Catches bugs at compile time. Sequelize v6 has decent TS support via `@types/sequelize`. **Confidence: HIGH** (Next.js 16 requirement). |

### Authentication & Security

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **jose** | 6.1.x | JWT signing/verification | Zero-dependency, Edge-runtime compatible (works in Next.js proxy.ts). Supports JWS, JWE, JWK, JWKS. Recommended by Next.js official docs over `jsonwebtoken`. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/jose), [Next.js auth guide](https://nextjs.org/docs/pages/guides/authentication)). |
| **bcryptjs** | 3.0.x | Password hashing | Pure JavaScript bcrypt -- no native compilation needed. Simpler deployment than `bcrypt` (no node-gyp). Slightly slower than native `bcrypt` but acceptable for auth flows. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/bcryptjs)). |

### Database Layer

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **sequelize** | 6.37.x | ORM | See core technologies above. |
| **mysql2** | 3.17.x | MySQL driver | Required by Sequelize for MySQL/MariaDB. Native async/await, prepared statements, connection pooling. Actively maintained (3.17.0 released 2026-02-11). **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/mysql2)). |

### Real-Time & Communication

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **socket.io** | 4.8.x | WebSocket server | Chat rooms, prayer wall live updates, notification delivery, typing indicators. Integrated via custom `server.js`. |
| **socket.io-client** | 4.8.x | WebSocket client | Client-side connection from React components. Must use `"use client"` directive in App Router. |
| **agora-rtc-sdk-ng** | 4.24.x | Live video/audio | Live workshop video streams. Create/join channels, publish/subscribe to tracks. |

### Notifications

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **web-push** | 3.6.x | Push notifications (VAPID) | Browser push notifications via service worker. Free, self-hosted, no third-party service needed. VAPID key pair for server identification. **Confidence: MEDIUM** (package not updated in ~2 years but Web Push API is stable; widely used). |
| **nodemailer** | 8.0.x | Email sending | Transactional emails (welcome, password reset, prayer notifications). Works with any SMTP provider. Zero dependencies. Self-hosted friendly -- no vendor lock-in. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/nodemailer)). |
| **twilio** | 5.12.x | SMS notifications | SMS alerts for prayer requests, workshop reminders. Pay-per-message pricing. Industry standard for programmable SMS. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/twilio)). |

### Form Handling & Validation

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **react-hook-form** | 7.71.x | Form state management | All forms: registration, login, post creation, profile editing, prayer submissions. Minimal re-renders, built for performance. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/react-hook-form)). |
| **zod** | 4.3.x | Schema validation | Shared validation schemas between client forms and API routes. Auto-generates TypeScript types. Use with `@hookform/resolvers`. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/zod)). |
| **@hookform/resolvers** | latest | Bridge RHF + Zod | Connects Zod schemas to react-hook-form. Install alongside both. |

### UI & Styling

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **tailwindcss** | 4.1.x | Utility CSS | All styling. Mobile-first responsive design with `sm:`, `md:`, `lg:` breakpoints. Card-based layouts. |
| **lucide-react** | 0.563.x | Icon library | UI icons throughout the app. Tree-shakable -- only imported icons ship to client. Fork of Feather Icons with active maintenance. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/lucide-react)). |

### Media & Content

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **sharp** | 0.34.x | Image processing | Server-side image resizing for user uploads (avatars, post images). Required by Next.js for production image optimization. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/sharp), [Next.js docs](https://nextjs.org/docs/messages/install-sharp)). |

### Utilities

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **date-fns** | 4.1.x | Date manipulation | Formatting timestamps for posts, prayer wall entries, workshop schedules. Tree-shakable (import only what you need). Functional approach -- works with native Date objects. **Confidence: HIGH** (verified via [npm](https://www.npmjs.com/package/date-fns)). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Turbopack** | Bundler (dev + build) | Default in Next.js 16. No configuration needed. 2-5x faster builds, up to 10x faster HMR. |
| **ESLint** | Linting | Note: `next lint` removed in Next.js 16. Run ESLint directly. Use `@next/eslint-plugin-next` (now flat config by default). |
| **Prettier** | Code formatting | Consistent code style across team. |
| **Biome** | Alt: Lint + Format | Alternative to ESLint+Prettier. Faster, single tool. Consider if starting fresh. |

---

## Architecture: Custom Server Pattern

Free Luma requires a **custom server** because Socket.IO needs a persistent HTTP server for WebSocket connections. This is the standard pattern for Next.js + Socket.IO:

```
server.js (Node.js HTTP server)
  |-- Next.js request handler (SSR, API routes, static files)
  |-- Socket.IO server (WebSocket connections)
```

### server.js Setup

```javascript
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer, {
    cors: { origin: process.env.ALLOWED_ORIGINS?.split(",") || [] }
  });

  io.on("connection", (socket) => {
    // Chat rooms, prayer wall, notifications
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "next build",
    "start": "NODE_ENV=production node server.js"
  }
}
```

**Why custom server:** Socket.IO requires a persistent HTTP server. Next.js API routes are stateless request/response -- they cannot maintain WebSocket connections. The custom server shares the same HTTP server between Next.js and Socket.IO.

**Trade-off:** Cannot deploy to Vercel (no WebSocket support). This is acceptable since the project targets self-hosted VPS deployment.

**Source:** [Official Socket.IO + Next.js guide](https://socket.io/how-to/use-with-nextjs)

---

## Deployment Architecture (Self-Hosted VPS)

```
Internet
  |
  v
Nginx (reverse proxy, SSL termination, static file caching)
  |
  v
Node.js (server.js: Next.js + Socket.IO)
  |
  v
MySQL/MariaDB (local or same VPS)
```

### Key Configuration

**next.config.ts:**
```typescript
const nextConfig = {
  output: 'standalone',  // Minimal production bundle (~100-200MB vs ~1GB)
  reactCompiler: true,   // Automatic memoization (stable in Next.js 16)
};
export default nextConfig;
```

**Nginx requirements:**
- `proxy_http_version 1.1` (required for WebSocket upgrade)
- `proxy_buffering off` (required for streaming SSR)
- WebSocket upgrade headers for Socket.IO path
- SSL via Let's Encrypt (certbot)

**Estimated cost:** $5-20/month VPS (Hetzner, DigitalOcean, Contabo) + $10-15/year domain + free SSL = ~$10-30/month total.

---

## Authentication Pattern

### JWT + HTTP-Only Cookies (NOT localStorage)

```
Login flow:
  1. Client submits credentials via react-hook-form
  2. API route validates with zod, checks bcryptjs hash
  3. jose signs JWT with server secret
  4. JWT set as HTTP-Only, Secure, SameSite=Strict cookie
  5. proxy.ts (formerly middleware.ts) checks cookie on protected routes
  6. API routes verify JWT via jose on each request
```

**Why HTTP-Only cookies over localStorage:**
- Immune to XSS attacks (JavaScript cannot read the cookie)
- Automatically sent with every request (no manual header management)
- `SameSite=Strict` prevents CSRF

**Why jose over jsonwebtoken:**
- Edge-runtime compatible (works in Next.js proxy.ts)
- Zero dependencies
- Active maintenance (v6.1.x as of 2026)
- Next.js officially recommends jose

**Why NOT NextAuth/Auth.js:**
- Adds unnecessary complexity for a custom JWT flow
- Designed for OAuth providers -- Free Luma uses email/password auth
- Harder to customize for custom user model with Sequelize
- If OAuth is added later, Auth.js v5 can be integrated incrementally

---

## Alternatives Considered

| Recommended | Alternative | Why Not the Alternative |
|-------------|-------------|------------------------|
| **Sequelize v6** | Prisma | Prisma has better TypeScript support and DX, but uses its own schema language and migration system that adds complexity. Sequelize maps more naturally to existing MySQL schemas and works better for self-hosted setups without Prisma's migration engine overhead. If team is TypeScript-first, Prisma is a valid choice. |
| **Sequelize v6** | Drizzle ORM | Drizzle is lighter and closer to raw SQL, which is great for performance-critical apps. But Sequelize's model-based associations (hasMany, belongsTo) map better to social platform entity relationships (User hasMany Posts, Post belongsTo User). Drizzle requires more manual relationship management. |
| **Sequelize v6** | Sequelize v7 (alpha) | v7 has better TypeScript support but is still in alpha (as of Feb 2026). Not production-ready. Use v6 stable; migrate to v7 when it reaches stable release. |
| **Socket.IO** | Native WebSocket API | Socket.IO adds rooms, namespaces, automatic reconnection, fallback to long-polling. Raw WebSocket requires building all of this manually. The abstraction cost is minimal. |
| **Socket.IO** | Pusher / Ably | Third-party hosted WebSocket services. Add cost and vendor dependency. Self-hosted Socket.IO is free and keeps data on your server -- important for a faith-based platform where prayer data is sensitive. |
| **jose** | jsonwebtoken | `jsonwebtoken` does not work in Edge runtime (proxy.ts). jose is zero-dependency and Next.js recommended. |
| **bcryptjs** | bcrypt (native) | Native `bcrypt` requires node-gyp and C++ compilation, which complicates Docker builds and VPS deployment. `bcryptjs` is pure JavaScript with identical API. The performance difference is negligible for auth flows. |
| **Agora SDK** | LiveKit (self-hosted) | LiveKit is open-source and self-hostable, but requires running a separate media server (significant DevOps overhead). Agora's free tier (10K min/month) is sufficient for early-stage workshops and removes video infrastructure complexity entirely. |
| **Agora SDK** | 100ms / Daily.co | Similar SaaS video APIs. Agora has the largest market share, best React/Next.js documentation, and most generous free tier. |
| **Tailwind CSS v4** | CSS Modules | CSS Modules require context switching between files. Tailwind's utility classes keep styling co-located with markup, which is faster for card-based responsive layouts. v4's performance improvements make build-time concerns irrelevant. |
| **Nodemailer** | Resend | Resend is a modern email API but adds vendor dependency and cost. Nodemailer works with any SMTP (including self-hosted Postfix or cheap transactional providers like Amazon SES at $0.10/1000 emails). Better for self-hosted philosophy. |
| **date-fns** | Day.js | Day.js is smaller (2KB) with a fluent API. date-fns is tree-shakable, functional, and works with native Date objects (no wrapper). Both are excellent; date-fns edges out for bundle size when tree-shaking is used and for projects already using functional patterns. |
| **react-hook-form + zod** | Formik + Yup | Formik has more re-renders and larger bundle. react-hook-form is purpose-built for performance. Zod generates TypeScript types automatically, unlike Yup. The combination is the modern standard. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Pages Router** | Legacy routing model. App Router is the future of Next.js with server components, streaming, and proxy.ts. All Next.js 16 features target App Router. | App Router |
| **jsonwebtoken** | Does not work in Edge/proxy.ts runtime. No ESM support. Stale maintenance. | jose |
| **Moment.js** | Deprecated by its own maintainers. Massive bundle size (300KB+). Mutable API causes bugs. | date-fns |
| **next-auth (v4)** | Outdated. If using Auth.js, use v5. But for custom JWT auth with Sequelize, jose is simpler and more appropriate. | jose + custom auth |
| **Sequelize v7** | Still in alpha. Breaking changes likely. No stable release date announced. | Sequelize v6 (6.37.x) |
| **`middleware.ts`** | Deprecated in Next.js 16. Renamed to `proxy.ts`. Still works but will be removed in a future version. | `proxy.ts` |
| **`next lint`** | Removed in Next.js 16. Run ESLint directly via CLI. | `eslint .` directly |
| **localStorage for JWT** | Vulnerable to XSS attacks. Any injected script can steal tokens. | HTTP-Only cookies |
| **Express.js** | Unnecessary layer. The custom `server.js` uses Node.js native `createServer()` with Next.js handler directly. Express adds overhead without benefit. | Node.js `createServer()` |
| **Webpack** | Turbopack is default and stable in Next.js 16. Only use Webpack if you have a specific plugin that hasn't been ported. | Turbopack (default) |
| **Firebase/Supabase** | Adds vendor dependency and recurring cost. The entire stack can be self-hosted on a VPS for $5-20/month. Keep data ownership. | Self-hosted MySQL + custom APIs |
| **Prisma** (for this project) | While excellent, Prisma's schema-first approach and migration engine add complexity for a project already committed to MySQL and traditional model-based ORM patterns. Sequelize is the simpler path here. | Sequelize v6 |
| **styled-components / Emotion** | CSS-in-JS has runtime cost and hydration issues with server components. Tailwind CSS is zero-runtime and works perfectly with RSC. | Tailwind CSS |

---

## Stack Patterns by Variant

**If adding OAuth login later (Google, Apple):**
- Add Auth.js v5 alongside jose
- Auth.js handles OAuth flow; jose continues handling custom JWT for API routes
- Because Auth.js v5 works with App Router and Server Components natively

**If real-time requirements grow beyond Socket.IO:**
- Consider Redis adapter for Socket.IO (`@socket.io/redis-adapter`) for horizontal scaling
- Because multiple Node.js processes need shared state for WebSocket rooms

**If video workshop attendance exceeds Agora free tier:**
- Agora pricing is usage-based ($3.99/1000 minutes after free tier)
- Evaluate LiveKit self-hosted if cost becomes prohibitive at scale
- Because LiveKit eliminates per-minute costs but adds infrastructure complexity

**If email volume exceeds SMTP limits:**
- Switch Nodemailer transport from direct SMTP to Amazon SES ($0.10/1000 emails)
- Because SES handles deliverability, bounce handling, and reputation management

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.1.x | react@19.2.x, react-dom@19.2.x | Must upgrade together. Use `npx @next/codemod@canary upgrade latest`. |
| next@16.1.x | Node.js >= 20.9.0 | Node.js 18 no longer supported in Next.js 16. |
| next@16.1.x | TypeScript >= 5.1.0 | TypeScript 5+ required. |
| sequelize@6.37.x | mysql2@3.17.x | mysql2 is the required driver for MySQL/MariaDB dialect. |
| tailwindcss@4.1.x | next@16.1.x | Zero-config in Tailwind v4. No `tailwind.config.js` needed (uses CSS-based config). |
| socket.io@4.8.x | socket.io-client@4.8.x | Server and client versions should match major.minor. |
| react-hook-form@7.71.x | @hookform/resolvers@latest, zod@4.3.x | All three must be installed together for Zod validation. |
| sharp@0.34.x | Node.js >= 18.17.0 or >= 20.3.0 | Required for Node-API v9 support. |
| jose@6.1.x | All runtimes | Works in Node.js, Edge, Browser, Deno, Bun. No compatibility issues. |

---

## Installation

```bash
# Core framework
npm install next@latest react@latest react-dom@latest

# Database
npm install sequelize@6 mysql2

# Authentication
npm install jose bcryptjs

# Real-time
npm install socket.io socket.io-client

# Live video
npm install agora-rtc-sdk-ng

# Styling & UI
npm install tailwindcss@latest lucide-react

# Forms & validation
npm install react-hook-form @hookform/resolvers zod

# Notifications
npm install web-push nodemailer twilio

# Media & utilities
npm install sharp date-fns

# Dev dependencies
npm install -D typescript @types/node @types/bcryptjs @types/nodemailer eslint prettier
```

---

## Node.js Version Requirement

**Use Node.js 20.x LTS (>= 20.9.0) or Node.js 22.x LTS.**

Next.js 16 dropped Node.js 18 support. Node.js 20 is the current LTS as of Feb 2026.

---

## PWA / Push Notification Architecture

For mobile-first experience without app store distribution:

```
Service Worker (sw.js)
  |-- Caches static assets for offline shell
  |-- Receives push events from web-push server
  |-- Displays notifications (daily Bible verse, prayer updates, workshop reminders)

manifest.json
  |-- App name, icons, theme color, display: standalone
  |-- Enables "Add to Home Screen" on mobile
```

**Key requirement:** HTTPS is mandatory for service workers and push notifications. Let's Encrypt + Nginx handles this.

**iOS support:** Web Push supported on iOS 16.4+ for PWAs added to home screen.

---

## Sources

- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16) -- verified features, version, breaking changes (HIGH confidence)
- [Next.js Self-Hosting Guide](https://nextjs.org/docs/app/guides/self-hosting) -- deployment patterns (HIGH confidence)
- [Socket.IO + Next.js Guide](https://socket.io/how-to/use-with-nextjs) -- custom server integration pattern (HIGH confidence)
- [npm: sequelize](https://www.npmjs.com/package/sequelize) -- v6.37.7 latest stable (HIGH confidence)
- [npm: mysql2](https://www.npmjs.com/package/mysql2) -- v3.17.0 (HIGH confidence)
- [npm: socket.io](https://www.npmjs.com/package/socket.io) -- v4.8.3 (HIGH confidence)
- [npm: agora-rtc-sdk-ng](https://www.npmjs.com/package/agora-rtc-sdk-ng) -- v4.24.2 (HIGH confidence)
- [Agora Web SDK Docs](https://docs.agora.io/en/sdks) -- SDK capabilities (HIGH confidence)
- [npm: tailwindcss](https://www.npmjs.com/package/tailwindcss) -- v4.1.18 (HIGH confidence)
- [npm: jose](https://www.npmjs.com/package/jose) -- v6.1.3 (HIGH confidence)
- [npm: bcryptjs](https://www.npmjs.com/package/bcryptjs) -- v3.0.3 (HIGH confidence)
- [npm: react-hook-form](https://www.npmjs.com/package/react-hook-form) -- v7.71.1 (HIGH confidence)
- [npm: zod](https://www.npmjs.com/package/zod) -- v4.3.6 (HIGH confidence)
- [npm: nodemailer](https://www.npmjs.com/package/nodemailer) -- v8.0.1 (HIGH confidence)
- [npm: twilio](https://www.npmjs.com/package/twilio) -- v5.12.x (HIGH confidence)
- [npm: sharp](https://www.npmjs.com/package/sharp) -- v0.34.5 (HIGH confidence)
- [npm: date-fns](https://www.npmjs.com/package/date-fns) -- v4.1.0 (HIGH confidence)
- [npm: lucide-react](https://www.npmjs.com/package/lucide-react) -- v0.563.0 (HIGH confidence)
- [npm: web-push](https://www.npmjs.com/package/web-push) -- v3.6.7 (MEDIUM confidence -- last published ~2 years ago but Web Push API is stable)
- [Next.js Auth Guide](https://nextjs.org/docs/pages/guides/authentication) -- jose recommendation (HIGH confidence)
- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps) -- PWA setup (HIGH confidence)
- [Sequelize v7 Status](https://github.com/sequelize/sequelize/discussions/16949) -- still alpha (MEDIUM confidence)
- [ORM Comparison 2026](https://www.nihardaily.com/173-the-best-nodejs-orms-in-2025-a-brutally-honest-review) -- Sequelize vs Prisma vs Drizzle (MEDIUM confidence -- community source)

---

*Stack research for: Free Luma -- faith-based social platform*
*Researched: 2026-02-11*
