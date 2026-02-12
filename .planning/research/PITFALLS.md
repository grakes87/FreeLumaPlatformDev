# Pitfalls Research

**Domain:** Faith-based social platform (complete rewrite from PHP/Node.js to Next.js)
**Researched:** 2026-02-11
**Confidence:** HIGH (based on codebase analysis, database inspection, and verified external sources)

## Critical Pitfalls

### Pitfall 1: Password Hash Format Incompatibility Breaks All Existing Users

**What goes wrong:**
The old database contains passwords hashed with PHP's `$2y$` bcrypt variant (confirmed in the SQL dump -- e.g., `$2y$10$7OEJW3PmIsGa1GPx...`). Node.js bcrypt uses the `$2b$` prefix. If the new system does not handle `$2y$` hashes, every single migrated user will fail authentication on first login. Worse, user ID 6 in the actual database has a plaintext password (`123zhr`), proving that some accounts were never properly hashed -- these users need special handling.

**Why it happens:**
Developers assume "bcrypt is bcrypt" without checking the prefix format. The old codebase already has a `$2y$` to `$2b$` conversion in its login controller (`src/controller/auth/login.js`), but this logic could be overlooked or incorrectly reimplemented during the rewrite. The existence of plaintext passwords in the database is an additional surprise that teams rarely anticipate.

**How to avoid:**
- Write a migration script that scans the users table and converts `$2y$` prefixes to `$2b$` (they are functionally equivalent). Run this BEFORE the new platform goes live.
- Identify and flag all accounts with plaintext passwords (no `$2` prefix). Force password reset for these accounts on first login.
- Write explicit integration tests that verify login works with: (a) `$2y$` hashes, (b) `$2b$` hashes, (c) plaintext passwords (should trigger forced reset).
- Keep the old system running in read-only mode during transition so users who cannot log in have a fallback.

**Warning signs:**
- No dedicated data migration script exists.
- Login tests only use freshly-hashed passwords, never imported ones.
- "Login broken" bug reports spike on launch day.

**Phase to address:**
Phase 1 (Foundation/Auth) -- password compatibility must be validated before any other feature testing begins.

---

### Pitfall 2: The Feature Parity Trap -- Trying to Rebuild Everything Before Launch

**What goes wrong:**
The old platform has 29+ database tables, 118 controller functions, and features spanning daily posts, workshops, chat, video library, Bible verses, notes, bookmarks, prayer wall, notifications, and more. Aiming for 1:1 feature parity before switching users over means the rewrite takes 6-12 months longer than expected, the old platform continues degrading (with its security vulnerabilities), and stakeholders lose confidence. Research shows that 50% of features in legacy systems are unused (Standish Group, 2014), and the push for parity is "almost universally impossible" to achieve (ThoughtWorks Technology Radar).

**Why it happens:**
Non-engineering stakeholders naturally define success as "everything the old system does, plus improvements." The development team feels pressure to replicate every edge case. Meanwhile the old system continues to evolve, creating a moving target. The 10,000+ real users create fear of removing anything.

**How to avoid:**
- Audit which features are actually used by analyzing the existing database. Check which tables have meaningful data vs. empty or near-empty tables. Check user engagement: how many users have posts? How many have chat messages? How many attend workshops?
- Define an explicit "switchover MVP" -- the minimum set of features needed for existing users to move. This is NOT all features. It likely includes: auth (with data migration), feed/posts, daily posts, prayer wall, profile, and basic settings. Chat, workshops, video library, and notes can follow in rapid iterations.
- Set a hard deadline for the switchover. Features that are not ready get deferred, not added to the blocking list.
- Communicate to users: "We're upgrading! Some features are coming soon" is better than running an insecure old platform for another year.

**Warning signs:**
- The roadmap has a single "launch" milestone instead of an incremental rollout plan.
- Requirements documents reference "all existing features" without usage data.
- The estimated timeline exceeds 4 months for the first user-facing release.

**Phase to address:**
Phase 0 (Planning) -- define switchover MVP before writing code. Revisit at every phase boundary.

---

### Pitfall 3: Socket.IO + Next.js Custom Server Loses Critical Next.js Optimizations

**What goes wrong:**
Socket.IO requires a persistent server process, but Next.js API routes and the App Router are designed around request-response patterns without persistent connections. Using a custom server (required for Socket.IO) disables Automatic Static Optimization, which is one of Next.js's most important performance features. At scale (10,000+ concurrent users), Socket.IO hits practical ceilings of 10,000-30,000 concurrent connections per instance, with memory pressure, event loop contention, and garbage collection degradation. Trello and Disney+ Hotstar both abandoned Socket.IO for production at scale.

**Why it happens:**
The decision to use "Next.js all-in-one" conflicts with the need for persistent WebSocket connections. Teams assume they can use Next.js API routes for everything, then discover Socket.IO needs a separate server setup. By the time this is discovered, the architecture is already locked in.

**How to avoid:**
- Accept from day one that Socket.IO will run as a separate process on the same server, NOT embedded in Next.js API routes. Use a custom `server.js` that mounts both Next.js and Socket.IO on the same HTTP server, following the official Socket.IO + Next.js guide.
- Design the architecture so Socket.IO handles ONLY real-time events (chat messages, typing indicators, workshop presence, notifications). All CRUD operations go through Next.js API routes.
- Plan for Redis adapter from the start if horizontal scaling is ever needed (even if you start with a single server).
- Set `io.engine.on("connection", (rawSocket) => { rawSocket.request = null; })` to prevent Socket.IO memory leaks from holding HTTP request references.
- Monitor connection counts and memory usage from day one.

**Warning signs:**
- Socket.IO initialization code lives inside a Next.js API route.
- No memory monitoring in production.
- The words "we'll optimize later" appear in architecture discussions about WebSockets.
- Chat messages are being fetched via REST polling instead of arriving via Socket.IO.

**Phase to address:**
Phase 1 (Foundation) -- the custom server architecture must be established before any real-time features are built.

---

### Pitfall 4: Data Migration Treated as an Afterthought

**What goes wrong:**
The existing database has 29 tables with complex relationships, JSON columns (`liked_posts`, `notification_preference`), denormalized counts (`followers_count`, `posts_count`), and inconsistent data (e.g., `dob` field contains `0000-00-00` for many users, `country` column was added later with a default). Schema changes in the new system (renaming columns, changing types, adding constraints) require transformation scripts for every table. If migration is deferred to "later," the new schema design will unknowingly create incompatibilities that are expensive to fix.

**Why it happens:**
Migration is unglamorous work. Teams want to build new features, not write ETL scripts. The assumption is "we'll just import the SQL dump" -- but schema changes, data cleaning, and validation are substantial work that compounds with every table.

**How to avoid:**
- Write the migration script alongside the schema design -- not after. For every new model definition, write the corresponding transform from the old schema immediately.
- Create a staging database populated with a copy of real production data. Run all development and testing against this staging data, not fabricated test data.
- Document every schema difference between old and new in a tracking spreadsheet. This includes: column renames, type changes, new NOT NULL constraints that old data violates, foreign key relationships that old data lacks.
- Handle dirty data explicitly: `0000-00-00` dates, NULL emails, duplicate usernames, orphaned records (comments referencing deleted posts).
- Run the migration script end-to-end at least 5 times before the real migration, measuring time and catching errors.

**Warning signs:**
- Development uses `sequelize.sync({ force: true })` with fabricated seed data.
- No staging database with real data exists.
- Schema design discussions never reference the old table structures.
- The migration script has not been run successfully end-to-end even once.

**Phase to address:**
Phase 1 (Foundation/Database) -- schema design and migration scripts must be developed in parallel, not sequentially.

---

### Pitfall 5: Sequelize `sync()` in Production Destroys User Data

**What goes wrong:**
Sequelize's `sync({ force: true })` drops and recreates all tables. `sync({ alter: true })` can truncate tables during schema modifications. The old codebase uses Sequelize sync for development, and this pattern often carries into production. A single developer accidentally deploying with `force: true` or `alter: true` deletes the entire production database. Even `sync()` without options can create tables that conflict with migration-managed schemas.

**Why it happens:**
During development, `sync()` is convenient -- it auto-creates tables matching your models. When the habit carries to production, or when a new developer does not understand the difference, data loss occurs. The old codebase has a `migration.js` file but also uses sync patterns, creating ambiguity about which approach is canonical.

**How to avoid:**
- Never call `sequelize.sync()` in production. Use Sequelize CLI migrations exclusively for all schema changes.
- Add a startup guard: `if (process.env.NODE_ENV === 'production' && syncCalled) throw new Error('sync() forbidden in production')`.
- Set up the migration workflow from day one: `npx sequelize-cli migration:generate` for every schema change, `npx sequelize-cli db:migrate` for every deployment.
- Add a CI check that greps the codebase for `sync(` and fails if found outside of test files.
- Keep database backups automated with at least daily snapshots.

**Warning signs:**
- The words `sync(` appear in any file that runs in production.
- No migration files exist in the project.
- Database schema changes are made by modifying model files and restarting the server.

**Phase to address:**
Phase 1 (Foundation/Database) -- migration workflow must be established before the first table is created.

---

### Pitfall 6: External PHP API Dependency Creates a Silent Single Point of Failure

**What goes wrong:**
The daily content (Bible verses, positivity posts) comes from `kindredsplendorapi.com` -- an external PHP API. Email sends through `kindredsplendorapi.com/elegantapp/...`. SMS sends through `kindredsplendorapi.com/freelumatext/...`. If this server goes down, daily content stops, password resets break, and notifications fail -- all silently, with no retry logic. The old code uses synchronous HTTP calls with no timeout, error handling, or fallback.

**Why it happens:**
The dependency on the PHP API is inherited from the old system and feels "temporary." Teams plan to replace it "eventually" but build the new system with the same dependency. Since the API is self-owned (not a third-party service), there is no SLA or monitoring, and failures go unnoticed.

**How to avoid:**
- Wrap every external API call in a service layer with: timeout (5s), retry with exponential backoff (3 attempts), circuit breaker pattern, and graceful fallback.
- For daily content: cache the response locally. Bible verses and daily posts are deterministic by date -- cache them in the database so the external API is only needed once per day, not once per user request.
- For email: replace the PHP gateway with a direct SMTP integration (Nodemailer is already in the old codebase's dependencies) or a transactional email service (SendGrid, Postmark).
- For SMS: integrate Twilio directly instead of proxying through PHP.
- Add health checks and alerting for all external dependencies.

**Warning signs:**
- The new codebase makes HTTP calls to `kindredsplendorapi.com` without a timeout parameter.
- No fallback behavior exists when the external API returns an error.
- Daily content shows as blank/missing but no error is logged.

**Phase to address:**
Phase 2 (Daily Content) -- when daily posts are built, replace the PHP dependency rather than wrapping it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `sequelize.sync()` instead of migrations | Faster development setup | Production data loss risk, schema drift between environments | Development and test environments only, never production |
| Storing JWT in localStorage | Simple implementation | Vulnerable to XSS attacks; old platform had this exact issue | Never -- use HTTP-only cookies from day one |
| Denormalized counts (followers_count, posts_count on user record) | Avoids COUNT(*) queries on every page load | Counts drift out of sync over time; old database already shows inconsistencies | Acceptable if you implement a periodic reconciliation job and use transactions for increment/decrement |
| Hardcoding the daily content API URL | Faster initial integration | Cannot switch providers, no fallback when endpoint changes | Only in initial development; must move to environment variables before staging |
| Using `console.log` instead of a structured logger | Zero setup time | Cannot search/filter/alert on logs in production; old system had a 237KB error_log.txt that was unreadable | Never in production code; set up structured logging (pino or winston) in Phase 1 |
| Storing files on local filesystem instead of object storage | No external service dependency | Server migration requires file copying; disk fills up; no CDN; no redundancy | Acceptable for Phase 1 MVP if you abstract behind a storage service interface |
| CORS `origin: *` (allow all) | No cross-origin issues during development | Security vulnerability; old codebase had this exact issue | Development only; production must whitelist specific origins |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Agora SDK (Workshops) | Generating tokens at workshop creation time. Tokens expire in 24 hours, so workshops scheduled days in advance have expired tokens by start time. | Generate tokens on-demand when a user joins a workshop. The token endpoint should calculate expiry based on the workshop's scheduled end time plus a buffer. |
| Agora SDK (Workshops) | Using the same `uid` for multiple users in a channel. The old code generates meeting IDs but does not enforce unique UIDs per participant. | Assign unique integer UIDs per user per channel. Map your internal user IDs to Agora UIDs. Store the mapping for reconnection scenarios. |
| Socket.IO (Chat) | Assuming `connectedUsers` Map survives server restarts. The old code stores user-to-socket mappings in memory. Server restart = all connections lost, no recovery. | Implement reconnection handling on the client. On reconnect, re-emit `user-connected`. Consider persisting online status in Redis or the database for cross-restart continuity. |
| Socket.IO (Chat) | Not cleaning up event listeners in React components using `useEffect`. Each re-render adds a new `socket.on()` listener, causing duplicate message delivery. | Always return a cleanup function from `useEffect` that calls `socket.off()` for every `socket.on()`. |
| Email (kindredsplendorapi.com) | Using HTTP GET with email content in query parameters. The old system passes email body as a URL parameter, which has length limits and logs sensitive content in server access logs. | Use POST requests for email sending, or switch to Nodemailer with direct SMTP. |
| Daily Content API | Calling the external API on every user request for daily content. Content is the same for all users on a given date. | Fetch once per day per category, cache in database or in-memory cache (node-cache). Serve all users from cache. |
| Web Push Notifications | Storing VAPID keys in the database or source code. The old system has `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY` as env vars, which is correct, but push subscription cleanup is missing. | Keep VAPID keys in env vars. Implement subscription cleanup: when a push fails with a 410 (Gone) status, delete that subscription from the database. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries from Sequelize eager loading misconfiguration | Feed page takes 5+ seconds to load; database shows hundreds of queries per page load | Use `include` with specific attributes in Sequelize queries. Profile queries with `logging: console.log` during development. Use `findAll` with joins instead of loading associations in loops. | At 100+ posts in a feed (likely from day one with migrated data) |
| No pagination on feed/prayer wall/comments | Page load time grows linearly with content volume; browser tab crashes on large feeds | Implement cursor-based pagination from day one. The old database has thousands of posts -- migrated data will immediately expose unpaginated queries. | Immediately with migrated data (existing platform has years of content) |
| Socket.IO broadcasting to all connected clients | CPU spike when any user sends a message; all users receive events they do not need | Use Socket.IO rooms for targeted broadcasting. Chat messages go to the room for that conversation. Workshop events go to the room for that workshop. Never use `io.emit()` for user-specific events. | At 100+ concurrent connections |
| Unoptimized image handling | Large profile pictures and post images slow page loads; bandwidth costs increase | Implement image resizing on upload (sharp library). Serve WebP format. Set far-future cache headers on image URLs. Use `next/image` for automatic optimization on the frontend. | At 50+ posts with images in a feed |
| Storing `liked_posts` as JSON array on the user record | Array grows unbounded; checking "did user like this post" requires parsing the entire JSON array; updates require read-modify-write cycle | Use a separate `post_likes` junction table (user_id, post_id, created_at). Query with a simple `WHERE` clause. The old database stores liked_posts as JSON, and this must NOT be carried forward. | At 100+ likes per user (power users will hit this quickly) |
| Full-text search on posts/content without indexes | Search queries scan entire tables; response time degrades linearly with data volume | Add FULLTEXT indexes on searchable columns (post content, user names). Consider Meilisearch or Algolia for complex search later. | At 10,000+ posts (which already exist in the migrated data) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Repeating the old system's JWT-in-localStorage pattern | XSS attack steals authentication token; attacker gains full account access. This was an identified vulnerability in the old system. | Store JWT in HTTP-only, Secure, SameSite=Strict cookies. Never expose tokens to JavaScript. Implement CSRF protection for cookie-based auth. |
| Not implementing rate limiting on auth endpoints | Brute force password attacks against the 10,000+ migrated user accounts. The old system had zero rate limiting. | Use `express-rate-limit` or equivalent middleware. Auth endpoints: 5 attempts per 15 minutes per IP. API endpoints: 100 requests per minute per user. |
| Trusting user-supplied IDs without authorization checks | User A can view/edit/delete User B's posts, notes, or profile by changing the ID in the request. The old system had no ownership validation. | Every endpoint that accesses user-owned data must verify `req.user.id === resource.user_id`. Use middleware to enforce this pattern consistently. |
| Exposing sensitive data in API responses | Password hashes, email addresses, phone numbers returned in API responses for other users' profiles. The old system's user model returns all fields. | Define explicit `attributes` in every Sequelize query. Create separate response DTOs for "own profile" vs "public profile." Never return `password` field in any response. |
| No content moderation on user-generated posts and prayer requests | A faith-based platform with unmoderated content risks offensive/harmful posts that damage community trust and safety. The old system had no moderation tools. | Implement a report/flag system from day one. Add admin moderation queue. Consider basic keyword filtering for profanity. Phase 2 can add more sophisticated moderation. |
| Using the old `ACCESS_TOKEN` JWT secret in the new system | If the old JWT secret was compromised (it was in an unprotected .env file), old tokens could be used to authenticate in the new system. | Generate a new, strong JWT secret for the new system. This intentionally invalidates all old sessions, which is acceptable during a platform migration. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Launching the new platform without user communication | Users arrive to find a completely different interface with no warning; confusion causes support tickets and churn | Send email/push notifications 2 weeks before migration explaining the change. Show a "What's New" overlay on first login. Maintain a FAQ page. |
| Requiring all users to reset passwords on migration day | 10,000+ users must take action to use the platform; most will not bother and churn | Migrate passwords transparently using the bcrypt prefix conversion described in Pitfall 1. Only force resets for the accounts with plaintext passwords. |
| Breaking deep links and bookmarks from the old platform | Users who bookmarked their profile, favorite posts, or daily content pages get 404 errors | Implement redirect rules from old URL patterns to new ones. Old paths like `/daily-post` should map to the equivalent new route. |
| Removing features users depend on without notice | "Where did my notes go?" "Where are my bookmarks?" -- users lose trust even if the features return later | For any feature deferred past switchover: show a "Coming Soon" placeholder with an estimated date. Never silently remove a feature. |
| Making the daily post less prominent in the new design | The daily inspirational post is the core retention driver -- users open the app specifically for this. If it is buried in the new navigation, daily engagement drops. | Daily post should be the first thing users see (home screen default or prominent tile). Preserve the notification system that alerts users when the daily post is available. |
| Not preserving user content during migration | Users who created posts, prayer requests, and notes on the old platform expect to find them on the new one | Migrate all user-generated content. Display it correctly even if the new UI renders it differently. Test with real data, not test data. |

## "Looks Done But Isn't" Checklist

- [ ] **Authentication:** Login works with freshly-created accounts but fails for migrated users with `$2y$` password hashes -- test with real migrated data
- [ ] **User Profiles:** Profile page renders but profile pictures from old system show broken images -- verify old Cloudinary/local image URLs still resolve or provide migration
- [ ] **Feed Pagination:** Feed loads but only shows the first page -- verify "load more" / infinite scroll works with 1000+ migrated posts
- [ ] **Daily Posts:** Daily post shows but only in English -- verify Spanish language variant works and Bible translation selection (KJV, NIV, NRSV, NAB) is functional
- [ ] **Socket.IO Chat:** Chat works between two users in the same browser but fails when the server restarts -- test reconnection behavior
- [ ] **Workshops (Agora):** Workshop creation works but joining fails if the token was generated more than 24 hours ago -- test with pre-scheduled workshops
- [ ] **Push Notifications:** Notifications send successfully but are not received on iOS Safari -- verify VAPID web push works across all target browsers
- [ ] **Search:** User search returns results but only matches exact names -- verify partial matching and case-insensitive search
- [ ] **Settings:** Settings save but do not persist after logout/login -- verify settings are stored server-side, not just in local state
- [ ] **i18n:** English UI works but Spanish translations show raw keys like `feed.title` -- verify all translation files are loaded and complete
- [ ] **Dark Mode:** Dark mode toggle works but some components still show white backgrounds -- test every page in dark mode
- [ ] **Mobile Responsiveness:** Home page is responsive but modals and overlays break on small screens -- test all interactive elements on 375px width

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Password hash incompatibility (all migrated users locked out) | LOW if caught in staging, HIGH if caught in production | Run `UPDATE users SET password = REPLACE(password, '$2y$', '$2b$') WHERE password LIKE '$2y$%'` on the database. Force password reset for plaintext accounts. Redeploy. |
| Feature parity scope creep (timeline blown) | MEDIUM | Cut scope to switchover MVP. Deploy what exists. Communicate deferred features to users. Run old and new in parallel briefly if needed. |
| Socket.IO custom server misconfigured (no Automatic Static Optimization) | HIGH (requires architecture change) | If Socket.IO is embedded in API routes, extract to separate process. Restructure server.js to mount both Next.js and Socket.IO. Retest all SSR/SSG pages. |
| Data migration errors (corrupted/missing data in new database) | MEDIUM if backups exist, CRITICAL if not | Restore from backup. Fix migration script. Re-run migration. This is why running the migration 5+ times in staging is essential. |
| Sequelize sync() drops production tables | CRITICAL | Restore from most recent database backup. If no backup exists, attempt to recover from the SQL dump. Add the sync() guard and deploy. This is not recoverable without backups. |
| External PHP API goes down (daily content, email, SMS unavailable) | LOW with caching, HIGH without | If caching is implemented, content continues serving from cache. Without cache, implement emergency caching and direct integrations. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Password hash incompatibility | Phase 1 (Auth + Database) | Integration test: log in with a user record imported from the real production SQL dump |
| Feature parity scope creep | Phase 0 (Planning) | Switchover MVP defined with explicit feature list; reviewed every 2 weeks |
| Socket.IO custom server architecture | Phase 1 (Foundation) | Performance benchmark: confirm Automatic Static Optimization is working on static pages with Lighthouse |
| Data migration errors | Phase 1 (Database), ongoing | Migration script runs end-to-end on staging database copy; row counts match between old and new |
| Sequelize sync() in production | Phase 1 (Database) | CI check: `grep -r "sync(" src/` finds zero results outside test files |
| External PHP API dependency | Phase 2 (Daily Content) | Integration test: daily content loads when external API is unreachable (simulated network failure) |
| JWT in localStorage | Phase 1 (Auth) | Security audit: `grep -r "localStorage" src/` finds zero results related to tokens |
| No rate limiting | Phase 1 (Auth) | Penetration test: 20 rapid login attempts from same IP are blocked |
| No content moderation | Phase 2 (Social Features) | Report/flag button exists on every post and prayer request; admin queue page exists |
| Agora token expiry | Phase 3 (Workshops) | Integration test: workshop scheduled 48 hours in advance can be joined at start time |
| Socket.IO memory leaks | Phase 2 (Chat) | Load test: 500 concurrent connections sustained for 1 hour with stable memory usage |
| Daily content cache | Phase 2 (Daily Content) | Performance test: 100 concurrent requests for daily post all serve from cache; only 1 external API call per day |

## Sources

- Codebase analysis: `/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/.planning/codebase/CONCERNS.md` -- documents all security issues in old code (HIGH confidence)
- Codebase analysis: `/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/.planning/codebase/ARCHITECTURE.md` -- documents old system architecture (HIGH confidence)
- Codebase analysis: `/Applications/XAMPP/xamppfiles/htdocs/FreeLumaPlatform/.planning/codebase/INTEGRATIONS.md` -- documents all external dependencies (HIGH confidence)
- Database inspection: `Old Code/Main Free Luma Database.sql` -- 24MB SQL dump confirming `$2y$` hashes, plaintext passwords, 29 tables, 10,000+ user records (HIGH confidence)
- [Socket.IO: How to use with Next.js](https://socket.io/how-to/use-with-nextjs) -- official guide documenting custom server requirements and Vercel incompatibility (HIGH confidence)
- [Ably: Scaling Socket.IO -- Real-world challenges](https://ably.com/topic/scaling-socketio) -- documents 10k-30k connection limits, sticky session fragility, Redis bottleneck, Trello's abandonment of Socket.IO (MEDIUM confidence)
- [Wisp: Socket Communication Architecture in Next.js](https://www.wisp.blog/blog/choosing-the-right-architecture-for-socket-communication-in-nextjs-a-comprehensive-guide) -- comparison of custom server, Express.js, and vanilla approaches (MEDIUM confidence)
- [Security Boulevard: Auth Migration Hell](https://securityboulevard.com/2025/09/auth-migration-hell-why-your-next-identity-project-might-keep-you-up-at-night/) -- password hash incompatibility, processing bottlenecks, integration ripple effects (MEDIUM confidence)
- [ThoughtWorks Technology Radar: Legacy Migration Feature Parity](https://www.thoughtworks.com/radar/techniques/legacy-migration-feature-parity) -- warns against feature parity as migration goal (HIGH confidence)
- [UserJot: Feature Parity Trap](https://userjot.com/blog/feature-parity) -- 50% of legacy features unused, practical alternatives (MEDIUM confidence)
- [Sequelize v7 Docs: Model Synchronization](https://sequelize.org/docs/v7/models/model-synchronization/) -- official warning against sync() in production (HIGH confidence)
- [Sequelize v7 Docs: Migrations](https://sequelize.org/docs/v7/models/migrations/) -- official migration guide (HIGH confidence)
- [Agora Docs: Integration Issues](https://docs.agora.io/en/help/integration-issues/) -- token expiry, UID conflicts, API call sequencing (HIGH confidence)
- [Next.js Docs: Custom Server](https://nextjs.org/docs/pages/guides/custom-server) -- documents loss of Automatic Static Optimization with custom servers (HIGH confidence)
- [GitHub Discussion #17679: Next.js API route limitations](https://github.com/vercel/next.js/discussions/17679) -- response size limits, serverless function constraints (MEDIUM confidence)
- [Next.js App Router Caching Gotchas](https://pages.edgeone.ai/resources/nextjs-app-router-in-production) -- development vs production caching behavior divergence (MEDIUM confidence)

---
*Pitfalls research for: Free Luma Platform (faith-based social platform rewrite)*
*Researched: 2026-02-11*
