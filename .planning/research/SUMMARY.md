# Project Research Summary

**Project:** Free Luma Platform (Complete Rewrite)
**Domain:** Faith-based social platform with real-time features
**Researched:** 2026-02-11
**Confidence:** HIGH

## Executive Summary

Free Luma is a faith-based social platform combining daily inspirational content with community features and live video workshops. The recommended approach is a Next.js 16 App Router application with MySQL/Sequelize for persistence, Socket.IO for real-time features, and Agora for live video. The architecture requires a custom Node.js server to support WebSocket connections, which is standard for self-hosted deployments but eliminates Vercel as a hosting option.

The core value proposition centers on a "daily hook" pattern: curated Bible verses and positivity posts delivered via push notifications to drive daily engagement, combined with a prayer wall that creates emotionally resonant community interactions. Live workshops are the major differentiator but should be deferred until the social foundation is proven. The MVP should focus on auth, daily content, social feed, prayer wall, and push notifications. The existing platform has 10,000+ users with years of content that must be migrated.

Critical risks include password hash format incompatibility (the old PHP system uses `$2y$` bcrypt, some accounts have plaintext passwords), scope creep from trying to achieve feature parity with the legacy system (29 tables, 118+ controller functions), and Socket.IO scaling limitations at high concurrency. The rewrite must prioritize migration compatibility over feature completeness to get users onto the secure new platform quickly.

## Key Findings

### Recommended Stack

The modern Next.js 16 stack with self-hosted infrastructure provides the best balance of developer experience, performance, and deployment flexibility for a faith-based platform that must control its own data.

**Core technologies:**
- **Next.js 16 (App Router)** with React 19: All-in-one framework for SSR, API routes, and file-based routing. Turbopack bundler is now stable and default (2-5x faster builds). Custom server pattern required for Socket.IO.
- **MySQL/MariaDB** via XAMPP: Already installed. Reliable for structured social data. Use Sequelize v6 ORM for model-based associations.
- **Socket.IO 4.8.x**: Real-time communication for chat, prayer wall updates, notifications. Requires custom server.js mounting both Next.js and Socket.IO on shared HTTP server.
- **Agora Web SDK 4.24.x**: WebRTC-based live video for workshops. Free tier (10K min/month) eliminates need for self-hosted video infrastructure.
- **Tailwind CSS v4**: Utility-first CSS. v4 rewrite delivers 5x faster builds, zero config, CSS-native approach.
- **TypeScript 5.x** with **jose** for JWT auth (HTTP-only cookies, not localStorage), **bcryptjs** for password hashing, **react-hook-form + zod** for forms.

**Authentication:** Custom JWT flow with HTTP-only cookies. jose library is Edge-compatible (works in proxy.ts). Explicitly NOT using NextAuth/Auth.js because this is email/password auth with a custom user model, not OAuth.

**Deployment:** Self-hosted VPS ($5-20/month) with Nginx reverse proxy, SSL via Let's Encrypt. Output mode is NOT standalone (incompatible with custom server). Use PM2 or systemd to run `node server.js`.

### Expected Features

Daily content and prayer features are table stakes. Live workshops are the differentiator but defer until foundation is proven.

**Must have (table stakes):**
- Daily content feed (Bible verses, positivity posts) with push notification reminders
- Prayer wall with "praying for you" interaction and notifications
- Social feed (chronological posts from followed users)
- User profiles, asymmetric follow system, search
- Likes/reactions, comments, bookmarks
- Push notifications (in-app + browser push API)
- Multiple Bible translations via API (API.Bible)

**Should have (competitive):**
- Direct messaging / chat (1:1 with Socket.IO)
- Notes (personal annotations on content)
- Video library (on-demand recorded workshops)
- Engagement streaks (daily check-in, prayer habits)
- Faith-themed reactions ("amen," "praying") instead of generic likes

**Defer (v2+):**
- Live workshops with video (Agora SDK) -- highest complexity, highest differentiation
- Workshop scheduling, booking, and creator/host tools
- Workshop notes (collaborative real-time notes)
- Offline access (PWA service worker caching)
- Creator profiles with portfolio/verification
- Advanced algorithmic discovery (recommended content, trending)

**Anti-features (deliberately NOT build):**
- Algorithmic "For You" feed as default (chronological feed preferred for faith community values)
- Public vanity metrics (follower/like counts shown to all users -- theWell approach: private analytics)
- Open creator registration (invite/application-based to protect content quality)
- Anonymous posting (creates moderation nightmares)
- Donation/tithing features (fintech regulatory complexity)
- Church management suite (massive scope creep)

### Architecture Approach

Custom Node.js server (server.js) mounts both Next.js request handler and Socket.IO on a shared HTTP server. This is the standard pattern for Next.js + WebSocket on self-hosted infrastructure.

**Major components:**
1. **Custom server (server.js)** -- Single entry point running both Next.js and Socket.IO. Uses `createServer(handler)` with Socket.IO server attached. Deployed via `node server.js`.
2. **Next.js App Router** -- UI rendering with route groups: `(auth)` for unauthenticated pages, `(main)` for app shell with bottom nav. Server Components for static content, Client Components for interactive elements.
3. **API Route Handlers** -- All CRUD operations. Stateless request-response via `app/api/` directory. Auth middleware wrapper (`withAuth()`) extracts and verifies JWT on every protected route.
4. **Socket.IO Server** -- Real-time bidirectional events for chat, notifications, workshop presence. Event handlers organized in `src/lib/socket/` by feature. Shares user-socket mapping via in-memory Map (move to Redis adapter if scaling beyond single server).
5. **Sequelize ORM** -- Database access layer with singleton instance pattern (cached on globalThis in dev to survive HMR). Models define associations (User hasMany Posts, Post belongsTo User). Use migrations exclusively for schema changes (never sync() in production).
6. **Agora Integration** -- Client-side Agora Web SDK dynamically imported (ssr: false). Server generates RTC tokens via API route on-demand when user joins workshop.

**Database schema:** 6 logical domains (Identity, Social Graph, Content, Daily Content, Real-Time, Workshops). Schema improvements over old codebase: polymorphic likes/comments tables instead of JSON arrays, consistent soft-delete with `deleted_at`, single notifications table with `reference_id + reference_type` instead of sparse nullable FKs.

**Key patterns:**
- Custom server with Socket.IO attached (only viable pattern for self-hosted WebSocket)
- Singleton Sequelize instance with connection pooling (globalThis caching in dev)
- API route auth wrapper (withAuth HOF) for DRY authentication
- Agora SDK with dynamic import (prevents SSR crashes)
- Polymorphic associations for likes/comments/bookmarks (likeable_id + likeable_type)

### Critical Pitfalls

**1. Password Hash Format Incompatibility Breaks All Migrated Users**

The old database has passwords hashed with PHP's `$2y$` bcrypt variant. Node.js bcrypt uses `$2b$`. User ID 6 has a plaintext password (`123zhr`). If not handled, every migrated user fails login on day one.

**How to avoid:** Run migration script to convert `$2y$` to `$2b$` (functionally equivalent). Flag plaintext passwords and force reset. Write integration tests with real migrated data, not fabricated test data.

**2. Feature Parity Trap -- Trying to Rebuild Everything Before Launch**

The old platform has 29 tables, 118+ controller functions. Aiming for 1:1 parity means 6-12 month delay while the insecure old system continues running. Research shows 50% of legacy features are unused.

**How to avoid:** Define explicit "switchover MVP" based on usage data. Defer low-usage features (notes, video library, workshops) to post-launch iterations. Set hard deadline for switchover. Communicate "coming soon" features to users.

**3. Socket.IO + Custom Server Loses Next.js Optimizations**

Socket.IO requires persistent server, disabling Automatic Static Optimization. At 10K+ concurrent users, Socket.IO hits 10-30K connection ceiling with memory pressure and event loop contention.

**How to avoid:** Accept custom server pattern from day one. Design Socket.IO to handle ONLY real-time events (chat, notifications, presence) -- all CRUD via Next.js API routes. Plan Redis adapter for horizontal scaling. Monitor connection counts and memory from day one.

**4. Data Migration Treated as Afterthought**

29 tables with complex relationships, JSON columns, denormalized counts, dirty data (`0000-00-00` dates, NULL emails). Schema changes require transformation scripts for every table. If deferred, schema design will create expensive incompatibilities.

**How to avoid:** Write migration script alongside schema design. Create staging database with real production data. Document every schema difference. Handle dirty data explicitly. Run migration end-to-end 5+ times before go-live.

**5. External PHP API Dependency Creates Silent Single Point of Failure**

Daily content, email, and SMS all depend on `kindredsplendorapi.com`. If it goes down, daily content stops, password resets break, notifications fail -- all silently.

**How to avoid:** Cache daily content locally (Bible verses are deterministic by date). Replace email PHP gateway with direct Nodemailer SMTP. Replace SMS gateway with direct Twilio integration. Add timeout/retry/circuit breaker patterns. Health check monitoring.

**6. Sequelize sync() in Production Destroys User Data**

The old codebase uses sync() for development. `sync({ force: true })` drops all tables. One accidental deployment = total data loss.

**How to avoid:** Never call sequelize.sync() in production. Use Sequelize CLI migrations exclusively. Add startup guard that throws error if sync() called in production. Add CI check that greps codebase for `sync(` outside test files.

## Implications for Roadmap

Based on research, suggested phase structure follows dependency chains and defers high-complexity features until foundation is proven.

### Phase 1: Foundation (Auth + Database + Daily Content)

**Rationale:** Everything depends on user authentication and database access. Daily content is the core retention hook -- users open the app specifically for this. Must be flawless at launch.

**Delivers:**
- User authentication (email/password, JWT in HTTP-only cookies)
- User profiles with faith-specific fields (denomination, testimony, church)
- Database schema with all core models defined
- Data migration scripts for users table (with password hash conversion)
- Daily content API integration with local caching
- Daily post display on home screen
- Push notification infrastructure (web-push subscriptions)

**Addresses features:**
- User auth & profiles (table stakes)
- Daily content feed (table stakes -- THE engagement hook)
- Push notifications foundation (table stakes for retention)

**Avoids pitfalls:**
- Password hash incompatibility (migration script runs here)
- Sequelize sync() in production (migration workflow established here)
- External PHP API dependency (caching pattern established here)

**Research flag:** Standard patterns. No additional research needed.

### Phase 2: Core Social (Feed + Posts + Prayer Wall)

**Rationale:** Social graph (follows) and content creation (posts) are foundational to everything else. Prayer wall is table stakes for faith platforms and has disproportionate emotional engagement. Cannot build notifications, chat, or workshops without the social graph in place first.

**Delivers:**
- Post creation (text, images, Bible verse cards)
- Social feed (chronological posts from followed users, paginated)
- Follow/follower system (asymmetric)
- Prayer wall (posts filtered by type with "praying for you" interaction)
- Like/reaction system (polymorphic likes table)
- Comment system (polymorphic with threading support)
- Bookmarks (polymorphic)
- User search (basic full-text on names, usernames)
- File upload handling (profile pictures, post media)
- Profile pages (own + other users)
- Category system (groups/topics for organization)

**Addresses features:**
- Social feed (table stakes)
- Prayer wall (table stakes for faith platforms)
- Follow system (table stakes)
- Likes/reactions & comments (table stakes)
- Bookmarks (table stakes)
- User search (table stakes)

**Avoids pitfalls:**
- Feature parity trap (this is the switchover MVP -- workshops deferred)
- N+1 queries (Sequelize eager loading configured correctly)
- No pagination (cursor-based pagination from day one)
- liked_posts JSON array (using proper polymorphic likes table)

**Research flag:** Standard patterns. No additional research needed.

### Phase 3: Real-Time (Socket.IO + Chat + Notifications)

**Rationale:** Real-time features require Socket.IO infrastructure established in Phase 1 (custom server). Chat and notifications depend on the social graph from Phase 2 (you chat with followed users, notifications reference posts/comments/follows). Must come after social foundation is proven.

**Delivers:**
- Socket.IO initialization on custom server
- Socket.IO client provider (context + hooks)
- Chat model and API routes (message history)
- Real-time chat (send/receive messages, typing indicators)
- Chat UI (conversation list, message thread)
- Notification model and API routes
- Real-time notification delivery via Socket.IO
- Notification UI (badge, activity feed/list page)
- Web push notifications (browser push via service worker)

**Addresses features:**
- Direct messaging / chat (should-have after validation)
- In-app activity notifications (should-have)
- Push notifications (completion of foundation work)

**Avoids pitfalls:**
- Socket.IO custom server architecture (pattern established in Phase 1)
- Socket.IO memory leaks (event listener cleanup in React components)
- Socket.IO broadcasting to all (using rooms for targeted delivery)
- Not cleaning up subscriptions (web push 410 Gone handling)

**Research flag:** Standard Socket.IO patterns. No additional research needed.

### Phase 4: Enhanced Content (Notes + Video Library + Settings)

**Rationale:** Content enhancements that build on Phase 2 foundation. Notes attach to posts/verses. Video library displays recorded workshops (even before live workshops exist). Settings personalize the experience. Lower priority than real-time communication.

**Delivers:**
- Notes model and CRUD API (personal annotations)
- Notes UI (attached to posts, verses, daily content)
- Video library model and listing page
- Video progress tracking
- Settings page (appearance, notification preferences, account settings)
- Dark mode / system theme toggle
- Language selection (English/Spanish)
- Email integration (password reset, welcome emails via Nodemailer)

**Addresses features:**
- Notes (should-have)
- Video library (should-have)
- Settings (table stakes)

**Avoids pitfalls:**
- Email dependency (direct Nodemailer SMTP, not PHP gateway)

**Research flag:** Standard patterns. No additional research needed.

### Phase 5: Workshops (Live Video + Scheduling + Creator Tools)

**Rationale:** Workshops are the highest-complexity, highest-differentiation feature. Depend on Socket.IO (Phase 3), categories (Phase 2), and Agora SDK integration. Should be deferred until the platform has proven engagement with core social features. Workshops require creator supply -- need active community first.

**Delivers:**
- Workshop series and workshop models
- Workshop creation / scheduling UI
- Agora RTC token generation API route
- Workshop room page (Agora SDK dynamic import)
- Workshop invitation model and UI
- Workshop presence via Socket.IO (user-joined, user-left events)
- Workshop chat (in-workshop text chat via Socket.IO)
- Creator/host tools (dashboard for workshop management)
- Workshop interest tracking
- Workshop blocked users management

**Addresses features:**
- Live workshops (video) -- major differentiator (defer until PMF)
- Workshop scheduling & booking (defer until PMF)
- Creator/host tools (defer until PMF)

**Avoids pitfalls:**
- Agora token expiry (tokens generated on-demand when user joins, not at workshop creation)
- Agora UID conflicts (unique integer UIDs per user per channel)
- Agora SDK SSR crashes (dynamic import with ssr: false)

**Research flag:** Agora integration is well-documented but may need additional research during phase planning for specific features like recording, screen sharing, or advanced controls.

### Phase 6: Migration & Launch

**Rationale:** Final data migration and switchover. All user-generated content (posts, comments, prayer requests, bookmarks, notes) migrated from old platform. Users transitioned to new system with communication and support.

**Delivers:**
- Complete data migration scripts for all tables
- Data validation and integrity checks
- URL redirect rules (old URLs to new routes)
- User communication (email announcements, "What's New" guide)
- Support documentation and FAQ
- Monitoring and alerting setup
- Performance optimization (image optimization, query tuning)
- Security hardening (rate limiting, CORS, CSRF protection)

**Avoids pitfalls:**
- Data migration errors (migration run 5+ times in staging)
- Breaking deep links (redirect rules for all old URL patterns)
- Requiring all users to reset passwords (transparent migration)
- No user communication (2-week advance notice, What's New overlay)
- Removing features without notice ("Coming Soon" placeholders)

**Research flag:** No additional research needed. Migration process follows standard ETL patterns with domain-specific data cleaning.

### Phase Ordering Rationale

- **Foundation first** because every feature needs auth, database, and daily content is the core hook.
- **Core Social before Real-Time** because chat and notifications reference users, posts, follows, and comments. Cannot notify about a like if the like system does not exist.
- **Real-Time before Workshops** because workshops use Socket.IO for presence and in-workshop chat.
- **Enhanced Content can parallel with Real-Time** (Phases 3 and 4 are mostly independent) but both depend on Phase 2.
- **Workshops last among features** because they have the most dependencies (auth, categories, Socket.IO, Agora) and highest complexity.
- **Migration after all features** because you need a complete system to migrate into. Testing migration requires all features operational.

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Next.js auth, Sequelize setup, daily content API integration -- all well-documented
- **Phase 2 (Core Social):** Standard social platform patterns (feed, posts, follows) -- extensive documentation
- **Phase 3 (Real-Time):** Socket.IO + Next.js custom server -- official guide available
- **Phase 4 (Enhanced Content):** Standard CRUD patterns -- no special research needed
- **Phase 6 (Migration):** Domain-specific but follows standard ETL patterns

**Phases likely needing deeper research during planning:**
- **Phase 5 (Workshops):** Agora SDK integration is well-documented, but specific workshop features (recording, screen sharing, breakout rooms, advanced moderation) may need additional API research during phase planning. Web Push API browser compatibility matrix (iOS Safari requires PWA added to home screen). Workshop scheduling with timezone handling across international users.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies verified via official docs and npm. Next.js 16, React 19, Socket.IO 4.8.x, Sequelize 6, Agora 4.24.x, Tailwind v4 all confirmed as latest stable versions with self-hosting compatibility. |
| Features | HIGH | Competitor analysis covered 10+ faith platforms (YouVersion, Pray.com, Glorify, ActsSocial, theWell, Faithlife). Table stakes and differentiators clearly identified. MVP definition aligns with successful patterns. |
| Architecture | HIGH | Next.js + Socket.IO custom server pattern verified via official Socket.IO guide. Database schema patterns validated against old codebase (30+ models analyzed). Self-hosted deployment architecture standard for VPS. |
| Pitfalls | HIGH | Critical pitfalls identified from old codebase analysis (CONCERNS.md, database dump inspection) and verified external sources (Socket.IO scaling challenges, migration best practices, Sequelize production gotchas). |

**Overall confidence:** HIGH

Research is comprehensive, verified with primary sources, and directly applicable to Free Luma's requirements. The custom server pattern, migration challenges, and feature prioritization are all grounded in analysis of the existing codebase and verified best practices.

### Gaps to Address

**Password hash handling specifics:**
While bcrypt `$2y$` to `$2b$` conversion is understood, the migration script should be tested with the actual production SQL dump during Phase 1 implementation. Edge cases (plaintext passwords, malformed hashes) need explicit handling code.

**Agora free tier limits:**
The free tier provides 10,000 minutes/month. With workshops averaging 60 minutes and 10 attendees, that supports ~16 workshops/month. Need to monitor usage and plan pricing tier upgrade path before hitting limits. During Phase 5 planning, validate whether Agora's free tier metrics match expected usage patterns.

**Web Push browser compatibility:**
Web Push on iOS Safari requires the app to be installed as a PWA (added to home screen). Need to validate this UX during Phase 1 push notification implementation and ensure the PWA manifest is configured correctly. Consider fallback notification strategy for users who do not install PWA.

**i18n implementation details:**
Spanish language support is a requirement but research did not cover specific i18n libraries. During Phase 4 planning, evaluate next-intl vs. next-i18next for App Router compatibility. Daily content API supports multiple languages but translation coverage for UI needs validation.

**Content moderation approach:**
Research identified need for content moderation but did not specify tooling. During Phase 2 implementation, evaluate whether to build custom report/flag system or integrate third-party moderation API (e.g., OpenAI Moderation API for automated flagging). Faith-based context requires custom keyword lists.

## Sources

### Primary (HIGH confidence)

**Stack Research:**
- Next.js 16 Release Blog (official)
- Socket.IO + Next.js Guide (official)
- npm package pages for all core dependencies (latest versions verified)
- Sequelize v6 documentation (official)
- Agora Web SDK documentation (official)

**Features Research:**
- faith.tools app directory (comprehensive competitor list)
- ActsSocial, YouVersion, Pray.com, Glorify, theWell, Faithlife (competitor platform analysis)
- ActsSocial blog posts on faith app features (2026 best practices)

**Architecture Research:**
- Old codebase analysis: 30+ Sequelize models, database schema, API routes examined
- Main Free Luma Database.sql dump (24MB, 10K+ users, 29 tables analyzed)
- Next.js App Router documentation (official)
- Socket.IO documentation (official)

**Pitfalls Research:**
- `.planning/codebase/CONCERNS.md` (security issues in old code)
- `.planning/codebase/ARCHITECTURE.md` (old system architecture)
- `.planning/codebase/INTEGRATIONS.md` (external dependencies)
- Database dump inspection (password formats, data quality issues)

### Secondary (MEDIUM confidence)

**Stack Research:**
- ORM comparison articles (Sequelize vs Prisma vs Drizzle)
- Tailwind CSS v4 migration guide
- PWA implementation patterns

**Features Research:**
- Social media platform success factors (2026 trends)
- ThoughtWorks Technology Radar (legacy migration guidance)
- UserJot feature parity analysis

**Pitfalls Research:**
- Ably: Scaling Socket.IO challenges
- Security Boulevard: Auth migration pitfalls
- Sequelize migration best practices
- Agora integration issues guide

### Tertiary (LOW confidence)

- GeeksforGeeks social media database design (schema patterns reference)
- Community blog posts on Next.js + Socket.IO (supplementary to official guide)

---

*Research completed: 2026-02-11*
*Ready for roadmap: yes*
