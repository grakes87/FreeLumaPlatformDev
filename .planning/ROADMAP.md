# Roadmap: Free Luma Platform

## Overview

Free Luma Platform is a complete ground-up rewrite of an existing faith-based social platform with 10,000+ users. The roadmap follows a dependency-driven approach: foundation systems first (auth, database, daily content), then core social features (feed, prayer wall, follows), followed by real-time capabilities (chat, notifications via Socket.IO), enhanced content features (notes, video library, settings), live workshops (Agora integration), and finally data migration and production launch. Each phase delivers a coherent, verifiable capability that unblocks the next phase. The structure prioritizes getting users onto the secure new platform quickly while deferring high-complexity differentiators (live workshops) until the social foundation is proven.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Auth, database, daily content, and core infrastructure
- [ ] **Phase 2: Core Social** - Feed, posts, prayer wall, follows, and social interactions
- [ ] **Phase 3: Real-Time** - Socket.IO, chat, and push notifications
- [ ] **Phase 4: Enhanced Content** - Notes, video library, settings, and personalization
- [ ] **Phase 5: Workshops** - Live video workshops via Agora SDK (v2 deferred)
- [ ] **Phase 6: Migration & Launch** - Data migration, production deployment, user switchover

## Phase Details

### Phase 1: Foundation
**Goal**: Secure authentication, database infrastructure, and daily content delivery established — users can sign up (invite-only), log in, complete guided onboarding, and receive their daily inspirational post in a 3-slide immersive experience with video backgrounds, audio player, and translation switching.

**Depends on**: Nothing (first phase)

**Requirements**: AUTH-01 through AUTH-10, PROF-01 through PROF-09, DAILY-01 through DAILY-10, UI-01 through UI-15, TECH-01 through TECH-15, SETT-02, SETT-03, NOTIF-10

**Success Criteria** (what must be TRUE):
  1. User can sign up with email/password and receive verification email
  2. User can log in and their session persists across browser refresh
  3. User can reset forgotten password via email link
  4. User can view their profile with avatar (photo upload or initials-based default)
  5. User sees curated daily post (Bible verse or positivity content) on home screen with proper formatting
  6. Daily post supports multiple Bible translations (KJV, NIV, NRSV, NAB) and respects language preference
  7. User can view past daily posts in history/archive view
  8. Daily post content fetches from external API with local caching fallback
  9. All passwords are hashed with bcrypt (no plaintext storage)
  10. Failed login attempts are rate-limited to prevent brute force
  11. Database uses Sequelize ORM with proper model associations and migrations (no sync() in production)
  12. All media stored in Backblaze B2 with Cloudflare CDN delivery
  13. App displays mobile-first card-based layout with dark mode support
  14. Bottom tab navigation provides access to main app sections
  15. Browser push notification infrastructure initialized (service worker, web push subscriptions)

**Plans**: 12 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffolding, Next.js setup, database connection, Tailwind v4, custom server
- [ ] 01-02-PLAN.md — Database models (9 models), Sequelize CLI migrations, seeders
- [ ] 01-03-PLAN.md — Shared UI component library (Button, Input, Card, Modal, Skeleton, Toast)
- [ ] 01-04-PLAN.md — App shell, route groups, bottom nav, top bar, dark mode, auth context
- [ ] 01-05-PLAN.md — Auth system (JWT, bcrypt, register, login, activation codes, rate limiting)
- [ ] 01-06-PLAN.md — Auth UI (login/signup pages) + Google and Apple OAuth integration
- [ ] 01-07-PLAN.md — 4-step onboarding flow (mode, profile, interests, follow suggestions)
- [ ] 01-08-PLAN.md — B2 storage, avatar upload/crop, profile card, initials avatar
- [ ] 01-09-PLAN.md — Daily content API, translation switching, bible.api fallback, timezone logic
- [ ] 01-10-PLAN.md — Daily content 3-slide UI (Swiper, video bg, audio+SRT, LumaShort)
- [ ] 01-11-PLAN.md — Settings page, password reset, email infrastructure, verify email banner
- [ ] 01-12-PLAN.md — Push notifications, admin endpoints (codes/content), entry pages (/bible, /positivity)

### Phase 2: Core Social
**Goal**: Complete social platform functionality — users can create posts (with multi-media), follow others, engage with content via reactions/comments, use the prayer wall, search for users, and manage their profile with dual feed styles (TikTok/Instagram) and admin dashboard.

**Depends on**: Phase 1 (requires auth, profiles, database)

**Requirements**: FEED-01 through FEED-14, PRAY-01 through PRAY-10, SOCL-01 through SOCL-15, CAT-01 through CAT-06, MOD-01 through MOD-05, CONT-01 through CONT-04, DAILY-07, DAILY-08, DAILY-09, PROF-03, PROF-04, PROF-05, PROF-06, PROF-07, PROF-08

**Success Criteria** (what must be TRUE):
  1. User can create text post with up to 10 media items (images/videos) in swipeable carousel
  2. User can view feed with FYP (For You) and Following tab toggle, with infinite scroll
  3. User can view feed in two admin-toggled styles: TikTok (full-screen swipe) and Instagram (card scroll)
  4. User can react to posts and comments with 6 emoji reactions (like, love, haha, wow, sad, pray)
  5. User can comment on posts with threaded replies (2 levels deep) in bottom sheet
  6. User can edit and delete their own posts and comments anytime (no time limit)
  7. User can bookmark posts for later reference and view saved posts on profile
  8. User can follow/unfollow other users with follow-request system for private profiles
  9. User can search for other users by name or username with avatar and bio preview
  10. User can view dedicated prayer wall feed (bible-mode only, hidden for positivity mode)
  11. User can create prayer request with anonymous option and tap "Praying for you" on others' requests
  12. Prayer counter displays on prayer request cards and author can view who prayed
  13. User can mark prayer request as "answered" with optional testimony
  14. User can quote-repost posts within the platform (no external sharing — members-only)
  15. User can report posts/comments with reason selection
  16. User can block other users (blocked user cannot see or interact with content)
  17. Post media is optimized server-side and served via CDN (Backblaze B2 + Cloudflare)
  18. Profile pages display with stats (posts, followers, following) and tabs (Posts, Reposts, Saved)
  19. Admin dashboard with moderation queue, analytics, feed style toggle, and mode isolation toggle
  20. Bottom nav updated with center '+' button for creating feed posts or prayer requests

**Plans**: 14 plans in 5 waves

Plans:
- [ ] 02-01-PLAN.md — Database foundation: 15 new tables, 14 new models, npm deps (obscenity, react-intersection-observer)
- [ ] 02-02-PLAN.md — Profanity filter, block utility, cursor pagination, Post CRUD API, media upload
- [ ] 02-03-PLAN.md — Follow system API (with request/accept), user search API, useFollow hook, FollowButton, UserSearchResult
- [ ] 02-04-PLAN.md — Post reactions API + comment reactions API, usePostReactions hook, PostReactionBar, PostReactionPicker
- [ ] 02-05-PLAN.md — Post comments API (threaded, 2 levels), usePostComments hook, PostCommentSheet, PostCommentThread
- [ ] 02-06-PLAN.md — Feed API (FYP + Following, cursor pagination, block exclusion, mode isolation), useFeed hook, useInfiniteScroll
- [ ] 02-07-PLAN.md — Prayer wall API (create, pray toggle, mark answered, feed with tabs), usePrayerWall, usePrayerToggle
- [ ] 02-08-PLAN.md — Bookmark API + Repost API + Block API + Report API, hooks, BookmarkButton, RepostButton, ReportModal
- [ ] 02-09-PLAN.md — Draft auto-save API + useDraft hook, Platform settings API, media compression utility
- [ ] 02-10-PLAN.md — Feed page UI: dual mode (TikTok/Instagram), PostCard variants, MediaCarousel, FeedTabs, EmptyFeedState
- [ ] 02-11-PLAN.md — Prayer wall page UI: PrayerCard (liquid glass), PrayerComposer, PrayButton, PrayerTabs, PrayerFilters
- [ ] 02-12-PLAN.md — Profile pages (own/public/edit), ProfileHeader, ProfileTabs, ProfileStats, FollowList, EditProfileForm
- [ ] 02-13-PLAN.md — Bottom nav '+' button, CreatePicker, PostComposer, post detail page, bookmarks page
- [ ] 02-14-PLAN.md — Admin dashboard (moderation queue, analytics, platform settings), FollowSuggestions update

### Phase 3: Real-Time
**Goal**: Real-time communication infrastructure operational — users can chat 1:1 and in groups via Socket.IO, receive instant in-app notifications with activity feed, and get email notifications for offline events. No browser push notifications.

**Depends on**: Phase 2 (requires social graph, posts, and follows)

**Requirements**: CHAT-01 through CHAT-10, NOTIF-01 through NOTIF-14, TECH-05, TECH-08

**Success Criteria** (what must be TRUE):
  1. User can initiate 1:1 direct message conversation with followed user
  2. User can send and receive text messages in real-time without page refresh
  3. User sees typing indicator when other user is typing
  4. User can view conversation list with recent messages, timestamps, and unread count
  5. Unread message badge displays on conversation list and bottom nav
  6. User can view full message history with pagination and delete own messages
  7. User can block other users from sending messages
  8. Chat connection gracefully handles disconnection and reconnection
  9. User receives in-app notification for new follows, likes, comments, prayer interactions, and DMs
  10. ~~User receives browser push notification~~ DEFERRED per CONTEXT — email-only for offline notifications (no browser push this phase)
  11. User can view in-app notification activity feed with grouped notifications
  12. User can configure notification preferences (email, push, in-app) per category
  13. User can set quiet hours for email notifications (push quiet hours deferred with browser push)
  14. User can mark notifications as read individually or all at once
  15. Notification badge displays count on bottom nav and browser tab
  16. Push notifications delivered via Socket.IO for real-time in-app alerts
  17. Email notifications include deep links back to relevant content

**Plans**: 13 plans in 4 waves

Plans:
- [ ] 03-01-PLAN.md — Socket.IO server init, auth middleware, presence manager, SocketContext provider
- [ ] 03-02-PLAN.md — Chat database: 7 tables (conversations, participants, messages, media, status, reactions, requests)
- [ ] 03-03-PLAN.md — Notification/email database: notifications + email_logs tables, user_settings extensions, types
- [ ] 03-04-PLAN.md — Chat API routes: conversations CRUD, messages CRUD, requests, chat media upload
- [ ] 03-05-PLAN.md — Socket.IO chat handlers: room management, typing indicators, read receipts, presence
- [ ] 03-06-PLAN.md — Notification core: createNotification(), grouping logic, notification API routes
- [ ] 03-07-PLAN.md — Chat UI: conversation list page, ConversationItem, UserPicker, OnlineStatusDot
- [ ] 03-08-PLAN.md — Chat UI: ChatView, MessageBubble, MessageInput, TypingIndicator, context menu, reactions
- [ ] 03-09-PLAN.md — Voice messages: useVoiceRecorder, VoiceRecorder, MediaAttachmentSheet, VoicePlayback
- [ ] 03-10-PLAN.md — Notification UI: dropdown, full page with filters, toast manager, notification context
- [ ] 03-11-PLAN.md — Group chat: GroupCreateFlow, GroupInfoSheet, MentionPicker, member management
- [ ] 03-12-PLAN.md — Email notifications: templates, queue, scheduler (node-cron), tracking, unsubscribe
- [ ] 03-13-PLAN.md — Integration: TopBar chat/bell badges, providers in layout, settings, profile message button, block behavior

### Phase 4: Enhanced Content
**Goal**: Content personalization and media library complete — users can create personal notes, access video library with progress tracking, and configure all app settings including appearance and privacy.

**Depends on**: Phase 2 (requires posts and content system)

**Requirements**: CONT-05 through CONT-12, SETT-01, SETT-04 through SETT-12, MOD-03, MOD-04

**Success Criteria** (what must be TRUE):
  1. User can create personal notes attached to posts or daily content
  2. User can view, edit, and delete their own notes
  3. Notes remain private by default with option to share
  4. User can access video library with on-demand recorded content
  5. User can play videos with progress tracking (resume where left off)
  6. Video library supports filtering by category and search by title
  7. User can bookmark videos for later viewing
  8. Video player tracks listen duration for analytics
  9. User can access settings page from account menu
  10. User can toggle appearance mode (light, dark, system)
  11. User can select language preference (English, Spanish) with instant UI update
  12. User can configure notification preferences by category
  13. User can set daily content reminder time with timezone support
  14. User can update account email address with verification
  15. User can change password with current password confirmation
  16. User can configure privacy settings (profile visibility, who can message)
  17. User can manage blocked users list
  18. User can view account stats (join date, activity streaks)
  19. User can delete account with confirmation (soft delete with grace period)
  20. Settings persist across devices and sessions
  21. Admin can view reported content in moderation queue
  22. Admin can remove inappropriate content with reason logging

**Plans**: TBD

Plans:
- [ ] 04-01: TBD during phase planning
- [ ] 04-02: TBD during phase planning

### Phase 5: Workshops (v2 - DEFERRED)
**Goal**: Live video workshop infrastructure complete — hosts can schedule and broadcast live workshops, attendees can join with video/audio participation, and workshops support real-time chat and presence tracking.

**Depends on**: Phase 3 (requires Socket.IO), Phase 2 (requires categories)

**Requirements**: WORK-01 through WORK-15, CRTR-01 through CRTR-06 (from v2 requirements)

**Success Criteria** (what must be TRUE):
  1. User can view upcoming workshop schedule with category and host info
  2. User can RSVP to workshops and receive reminder notifications
  3. Host can create workshop with title, description, schedule, and category
  4. Host can start workshop and broadcast video/audio via Agora Web SDK
  5. Attendee can join workshop room with video/audio participation
  6. Workshop room displays live attendee list with presence tracking via Socket.IO
  7. Workshop supports in-room text chat for Q&A and discussion
  8. Host can manage attendees (mute, remove, promote to co-host)
  9. Workshop supports screen sharing for presentations
  10. Workshop automatically records and saves to video library after completion
  11. User can take personal notes during live workshop session
  12. Host can invite specific users to private workshops
  13. Host can view creator dashboard with upcoming workshops and analytics

**Plans**: TBD (deferred to v2)

Plans:
- [ ] 05-01: TBD when workshop features planned
- [ ] 05-02: TBD when workshop features planned

### Phase 6: Migration & Launch
**Goal**: Production deployment with complete data migration — all existing users, content, and relationships transferred to new platform with zero data loss, secure password migration, and seamless user transition.

**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4 (all core features operational)

**Requirements**: MIG-01 through MIG-10, AUTH-10

**Success Criteria** (what must be TRUE):
  1. Migration script successfully converts all user data from old database to new schema
  2. Password hashes migrated with $2y$ to $2b$ bcrypt conversion (Node.js compatible)
  3. Plaintext passwords flagged and password reset forced on first login
  4. All user posts and comments migrated with preserved timestamps and authorship
  5. User follows and social graph migrated successfully with no broken relationships
  6. Prayer requests migrated with prayer counts and status (active/answered) preserved
  7. Bookmarks and notes migrated and linked to correct new user IDs
  8. Profile images migrated to new storage (Backblaze B2) and accessible via CDN
  9. Data validation ensures no orphaned records or broken foreign key relationships
  10. Migration rollback plan documented and tested in staging environment
  11. URL redirect rules implemented for all old URL patterns
  12. Production environment configured with HTTPS, rate limiting, and monitoring
  13. Error logging captures issues without exposing sensitive data to users
  14. User communication sent (email announcements, "What's New" guide)
  15. Support documentation and FAQ published for user questions

**Plans**: TBD

Plans:
- [ ] 06-01: TBD during phase planning
- [ ] 06-02: TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

**Parallel Opportunities:**
- Phase 3 (Real-Time) and Phase 4 (Enhanced Content) are mostly independent and can be partially parallelized after Phase 2 completes

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 12/12 | Complete | 2026-02-12 |
| 2. Core Social | 14/14 | Complete | 2026-02-14 |
| 3. Real-Time | 0/TBD | Not started | - |
| 4. Enhanced Content | 0/TBD | Not started | - |
| 5. Workshops (v2) | 0/TBD | Deferred | - |
| 6. Migration & Launch | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-11*
*Phase 1 planned: 2026-02-11 (12 plans in 5 waves)*
*Phase 2 planned: 2026-02-12 (14 plans in 4 waves)*
*Depth: Comprehensive (6 phases covering 165 v1 requirements)*
