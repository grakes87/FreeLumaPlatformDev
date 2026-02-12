# Requirements: Free Luma Platform

**Defined:** 2026-02-11
**Core Value:** Daily inspirational content delivery and faith-based community connection

## v1 Requirements

Requirements for initial release (switchover MVP + essential features). Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User receives email verification after signup
- [ ] **AUTH-03**: User can reset password via email link with secure token
- [ ] **AUTH-04**: User session persists across browser refresh via HTTP-only cookies
- [ ] **AUTH-05**: User can log in with email and password
- [ ] **AUTH-06**: User can log out and session is invalidated
- [ ] **AUTH-07**: Password is hashed with bcrypt (never stored in plaintext)
- [ ] **AUTH-08**: User password meets minimum security requirements (length, complexity)
- [ ] **AUTH-09**: Failed login attempts are rate-limited to prevent brute force attacks
- [ ] **AUTH-10**: User can migrate from old platform with existing credentials (handles $2y$ bcrypt variant)

### Profiles

- [ ] **PROF-01**: User can create profile with display name, username, and bio
- [ ] **PROF-02**: User can upload avatar image or use initials-based default avatar
- [ ] **PROF-03**: User can add faith-specific profile fields (denomination, church, testimony)
- [ ] **PROF-04**: User can view their own profile with stats (posts, comments, groups)
- [ ] **PROF-05**: User can view other users' profiles
- [ ] **PROF-06**: User can edit their own profile information
- [ ] **PROF-07**: User profile displays recent posts and activity
- [ ] **PROF-08**: User can set profile privacy controls (public, followers-only, private)
- [ ] **PROF-09**: User avatar displays properly in cards, comments, and chat

### Daily Content

- [ ] **DAILY-01**: User sees curated daily post (Bible verse or positivity content) on home screen
- [ ] **DAILY-02**: Daily post displays with proper formatting and imagery
- [ ] **DAILY-03**: Daily post supports multiple Bible translations (KJV, NIV, NRSV, NAB)
- [ ] **DAILY-04**: Daily post content is fetched from external API with local caching fallback
- [ ] **DAILY-05**: User can view past daily posts in a history/archive view
- [ ] **DAILY-06**: Daily post content respects user's language preference (English/Spanish)
- [ ] **DAILY-07**: User can bookmark daily posts for later reference
- [ ] **DAILY-08**: User can share daily post as image card to external platforms
- [ ] **DAILY-09**: Daily post includes category tag (Bible verse or Positivity)
- [ ] **DAILY-10**: System schedules daily post delivery at configured time with timezone support

### Social Feed

- [ ] **FEED-01**: User can view chronological feed of posts from followed users
- [ ] **FEED-02**: User can create text post with optional image attachment
- [ ] **FEED-03**: User can create post with Bible verse card (with translation selection)
- [ ] **FEED-04**: User can add category tags to posts (Prayer Requests, Testimony, etc.)
- [ ] **FEED-05**: User can edit their own posts within time limit
- [ ] **FEED-06**: User can delete their own posts
- [ ] **FEED-07**: Feed supports infinite scroll with cursor-based pagination
- [ ] **FEED-08**: User can filter feed by category (All, Prayer, Testimony, etc.)
- [ ] **FEED-09**: User can sort feed (Newest first, Most engaged)
- [ ] **FEED-10**: Post displays author avatar, name, timestamp, and content
- [ ] **FEED-11**: Post images are optimized and served via CDN (Backblaze B2 + Cloudflare)
- [ ] **FEED-12**: User can view post detail page with full comments thread
- [ ] **FEED-13**: Feed displays mix of followed users' posts and daily content
- [ ] **FEED-14**: Empty feed state shows helpful onboarding (suggest users to follow)

### Prayer Wall

- [ ] **PRAY-01**: User can view dedicated prayer wall feed (filtered prayer request posts)
- [ ] **PRAY-02**: User can create prayer request post (text only or with image)
- [ ] **PRAY-03**: User can set prayer request privacy (public, followers-only, private circle)
- [ ] **PRAY-04**: User can tap "Praying for you" button on prayer requests
- [ ] **PRAY-05**: Prayer request author receives notification when someone prays for them
- [ ] **PRAY-06**: Prayer counter displays on prayer request cards
- [ ] **PRAY-07**: User can view list of people who prayed for their request
- [ ] **PRAY-08**: User can view their own submitted prayer requests in profile
- [ ] **PRAY-09**: User can mark prayer request as "answered" with optional testimony
- [ ] **PRAY-10**: Prayer wall supports pagination and filtering by status (active, answered)

### Real-Time (Chat)

- [ ] **CHAT-01**: User can initiate 1:1 direct message conversation with followed user
- [ ] **CHAT-02**: User can send text messages in real-time via Socket.IO
- [ ] **CHAT-03**: User receives incoming messages in real-time without refresh
- [ ] **CHAT-04**: User can view conversation list with recent messages and timestamps
- [ ] **CHAT-05**: User sees typing indicator when other user is typing
- [ ] **CHAT-06**: Unread message count displays on conversation list and bottom nav badge
- [ ] **CHAT-07**: User can view full message history with pagination
- [ ] **CHAT-08**: User can delete their own messages (soft delete)
- [ ] **CHAT-09**: Chat connection gracefully handles disconnection and reconnection
- [ ] **CHAT-10**: User can block other users from sending messages

### Notifications

- [ ] **NOTIF-01**: User receives push notification for daily content reminder (scheduled time)
- [ ] **NOTIF-02**: User receives notification when someone follows them
- [ ] **NOTIF-03**: User receives notification when someone likes their post
- [ ] **NOTIF-04**: User receives notification when someone comments on their post
- [ ] **NOTIF-05**: User receives notification when someone prays for their prayer request
- [ ] **NOTIF-06**: User receives notification for new direct messages
- [ ] **NOTIF-07**: User can view in-app notification activity feed with grouped notifications
- [ ] **NOTIF-08**: User can configure notification preferences (email, push, in-app) per category
- [ ] **NOTIF-09**: User can set quiet hours for push notifications
- [ ] **NOTIF-10**: Browser push notifications work via service worker (requires HTTPS)
- [ ] **NOTIF-11**: Notification badge displays count on bottom nav and browser tab
- [ ] **NOTIF-12**: User can mark notifications as read individually or all at once
- [ ] **NOTIF-13**: Email notifications include deep links back to relevant content
- [ ] **NOTIF-14**: Push notifications delivered via Socket.IO for real-time in-app alerts

### Content Management (Notes/Bookmarks/Video Library)

- [ ] **CONT-01**: User can bookmark posts, prayer requests, and daily content
- [ ] **CONT-02**: User can view all bookmarked content in dedicated Bookmarks page
- [ ] **CONT-03**: User can organize bookmarks by folders or tags
- [ ] **CONT-04**: User can remove bookmarks
- [ ] **CONT-05**: User can create personal notes attached to posts or daily content
- [ ] **CONT-06**: User can view, edit, and delete their own notes
- [ ] **CONT-07**: Notes remain private by default with option to share
- [ ] **CONT-08**: User can access video library with on-demand recorded content
- [ ] **CONT-09**: User can play videos with progress tracking (resume where left off)
- [ ] **CONT-10**: Video library supports filtering by category and search by title
- [ ] **CONT-11**: User can bookmark videos for later viewing
- [ ] **CONT-12**: Video player tracks listen duration for analytics

### Social Interactions

- [ ] **SOCL-01**: User can follow other users (asymmetric follow system)
- [ ] **SOCL-02**: User can unfollow users
- [ ] **SOCL-03**: User can view list of users they follow
- [ ] **SOCL-04**: User can view list of users following them
- [ ] **SOCL-05**: User can like posts with single tap/click
- [ ] **SOCL-06**: User can unlike posts
- [ ] **SOCL-07**: Like count displays on post cards
- [ ] **SOCL-08**: User can comment on posts
- [ ] **SOCL-09**: User can reply to comments (threaded comments)
- [ ] **SOCL-10**: User can edit their own comments within time limit
- [ ] **SOCL-11**: User can delete their own comments
- [ ] **SOCL-12**: Comment count displays on post cards
- [ ] **SOCL-13**: User can search for other users by name or username
- [ ] **SOCL-14**: Search results display user avatars, names, and bio preview
- [ ] **SOCL-15**: User can share post to external platforms (copy link, social media)

### Settings & Personalization

- [ ] **SETT-01**: User can access settings page from account/profile menu
- [ ] **SETT-02**: User can toggle appearance mode (light, dark, system)
- [ ] **SETT-03**: User can select language preference (English, Spanish)
- [ ] **SETT-04**: User can configure notification preferences by category
- [ ] **SETT-05**: User can set daily content reminder time with timezone support
- [ ] **SETT-06**: User can update account email address with verification
- [ ] **SETT-07**: User can change password with current password confirmation
- [ ] **SETT-08**: User can configure privacy settings (profile visibility, who can message)
- [ ] **SETT-09**: User can manage blocked users list
- [ ] **SETT-10**: User can view account stats (join date, activity streaks)
- [ ] **SETT-11**: User can delete account with confirmation (soft delete with grace period)
- [ ] **SETT-12**: Settings persist across devices and sessions

### UI/UX (Mobile-First Design)

- [ ] **UI-01**: App displays with mobile-first, card-based layout inspired by ZOX design
- [ ] **UI-02**: Bottom tab navigation provides access to Feed, Groups/Categories, Create, Video Library, Account
- [ ] **UI-03**: Cards use clean white background with subtle shadows and rounded corners
- [ ] **UI-04**: Dark mode properly styles all UI components with appropriate contrast
- [ ] **UI-05**: All interactive elements have clear tap targets (minimum 44x44px)
- [ ] **UI-06**: Form validation provides clear, inline error messages
- [ ] **UI-07**: Loading states display skeleton screens or spinners appropriately
- [ ] **UI-08**: Empty states provide helpful guidance and call-to-action
- [ ] **UI-09**: Modal dialogs and overlays properly handle mobile viewport
- [ ] **UI-10**: Navigation maintains current tab state across interactions
- [ ] **UI-11**: Pull-to-refresh works on feed and content lists
- [ ] **UI-12**: Infinite scroll loads more content smoothly without jank
- [ ] **UI-13**: Images lazy load and display placeholder while loading
- [ ] **UI-14**: App is responsive and works well on tablet and desktop screens
- [ ] **UI-15**: All text is readable with proper font sizes and line height

### Categories/Groups

- [ ] **CAT-01**: User can view list of admin-defined content categories (e.g., Prayer, Testimony, Bible Study)
- [ ] **CAT-02**: User can browse category-specific content feeds
- [ ] **CAT-03**: User can follow/subscribe to specific categories
- [ ] **CAT-04**: Category tiles display on home screen with preview content
- [ ] **CAT-05**: Post composer allows selecting category tag from predefined list
- [ ] **CAT-06**: Category page displays description and member count

### Content Moderation

- [ ] **MOD-01**: User can report posts or comments with reason selection
- [ ] **MOD-02**: User can block other users (blocked user cannot see or interact with content)
- [ ] **MOD-03**: Admin can view reported content in moderation queue
- [ ] **MOD-04**: Admin can remove inappropriate content with reason logging
- [ ] **MOD-05**: All user-generated content runs through basic profanity filter on submission

### Data Migration

- [ ] **MIG-01**: Migration script converts user data from old database to new schema
- [ ] **MIG-02**: Password hashes migrated with $2y$ to $2b$ bcrypt conversion
- [ ] **MIG-03**: Plaintext passwords flagged and password reset forced on first login
- [ ] **MIG-04**: User posts and comments migrated with preserved timestamps
- [ ] **MIG-05**: User follows and social graph migrated successfully
- [ ] **MIG-06**: Prayer requests migrated with prayer counts preserved
- [ ] **MIG-07**: Bookmarks and notes migrated and linked to new user IDs
- [ ] **MIG-08**: Profile images migrated to new storage (Backblaze B2)
- [ ] **MIG-09**: Data validation ensures no orphaned records or broken relationships
- [ ] **MIG-10**: Migration rollback plan documented and tested

### Technical Infrastructure

- [ ] **TECH-01**: All API routes require authentication with JWT verification (except public endpoints)
- [ ] **TECH-02**: Database uses Sequelize ORM with proper model associations
- [ ] **TECH-03**: File uploads validate file type, size, and scan for malicious content
- [ ] **TECH-04**: All media stored in Backblaze B2 with Cloudflare CDN delivery
- [ ] **TECH-05**: Socket.IO server runs on custom Node.js server with Next.js handler
- [ ] **TECH-06**: Database migrations managed via Sequelize CLI (never sync() in production)
- [ ] **TECH-07**: Environment variables secure all API keys and credentials (no hardcoded secrets)
- [ ] **TECH-08**: CORS configured properly for API routes and Socket.IO
- [ ] **TECH-09**: Rate limiting implemented on authentication and API endpoints
- [ ] **TECH-10**: Input validation and sanitization on all user-submitted data
- [ ] **TECH-11**: SQL injection prevention via parameterized queries (Sequelize)
- [ ] **TECH-12**: XSS prevention via React's built-in escaping and Content Security Policy
- [ ] **TECH-13**: CSRF protection via SameSite cookies and token validation
- [ ] **TECH-14**: HTTPS enforced for all connections (SSL/TLS)
- [ ] **TECH-15**: Error logging and monitoring configured (errors don't expose sensitive data)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Live Workshops (Video)

- **WORK-01**: User can view upcoming workshop schedule with category and host info
- **WORK-02**: User can RSVP to workshops and receive reminder notifications
- **WORK-03**: Host can create workshop with title, description, schedule, and category
- **WORK-04**: Host can start workshop and broadcast video/audio via Agora Web SDK
- **WORK-05**: Attendee can join workshop room with video/audio participation
- **WORK-06**: Workshop room displays live attendee list with presence tracking via Socket.IO
- **WORK-07**: Workshop supports in-room text chat for Q&A and discussion
- **WORK-08**: Host can manage attendees (mute, remove, promote to co-host)
- **WORK-09**: Workshop supports screen sharing for presentations
- **WORK-10**: Workshop automatically records and saves to video library after completion
- **WORK-11**: User can take personal notes during live workshop session
- **WORK-12**: Workshop notes persist and attach to video library recording
- **WORK-13**: Host can invite specific users to private workshops
- **WORK-14**: Workshop interest tracking shows how many users want to attend
- **WORK-15**: Host dashboard displays workshop analytics (attendance, engagement, feedback)

### Creator/Host Tools

- **CRTR-01**: Host can apply for creator/host status with verification
- **CRTR-02**: Creator profile displays verified badge and portfolio of past workshops
- **CRTR-03**: Host can view creator dashboard with upcoming workshops and analytics
- **CRTR-04**: Host can schedule workshop series with recurring events
- **CRTR-05**: Host can set workshop capacity limits and manage waitlist
- **CRTR-06**: Host can send bulk invitations to followers for upcoming workshop

### Advanced Discovery

- **DISC-01**: User can view "Discover" tab with trending posts and popular content
- **DISC-02**: User receives personalized content recommendations based on interests
- **DISC-03**: User can view suggested users to follow based on activity and connections
- **DISC-04**: User can explore trending prayer topics and community discussions
- **DISC-05**: Search supports advanced filters (date range, category, user, content type)

### Engagement & Gamification

- **ENGJ-01**: User can view daily check-in streak (consecutive days opening app)
- **ENGJ-02**: User can view prayer streak (consecutive days praying for requests)
- **ENGJ-03**: User receives milestone badges for engagement achievements (private)
- **ENGJ-04**: User can view personal growth analytics (time spent, content consumed)
- **ENGJ-05**: User can set spiritual goals (daily Bible reading, prayer count)

### Enhanced Content Features

- **ECNT-01**: User can create Bible verse image cards with custom backgrounds and fonts
- **ECNT-02**: User can create multi-image posts (carousel/gallery)
- **ECNT-03**: User can embed video from external sources (YouTube, Vimeo)
- **ECNT-04**: User can create polls in posts for community input
- **ECNT-05**: User can schedule posts for future publication

### Advanced Social Features

- **ASCL-01**: User can create group chats with multiple participants
- **ASCL-02**: User can use faith-themed reactions beyond like (Amen, Praying, Hallelujah)
- **ASCL-03**: User can mention other users in posts and comments with @ notation
- **ASCL-04**: User can create private circles for sharing sensitive prayer requests
- **ASCL-05**: User can view network feed (posts from friends-of-friends, second-degree connections)

### Offline & PWA

- **PWA-01**: App functions as installable Progressive Web App (PWA)
- **PWA-02**: User can access cached daily content offline
- **PWA-03**: User can view bookmarked posts offline
- **PWA-04**: App syncs offline actions (likes, bookmarks) when connection restored
- **PWA-05**: Offline mode displays helpful messaging about limited functionality

### Internationalization

- **I18N-01**: UI supports full Spanish translation via i18n library (next-intl)
- **I18N-02**: Daily content supports Spanish devotionals and Bible verses
- **I18N-03**: User can toggle language preference with instant UI update
- **I18N-04**: Content created in one language displays language indicator to other users

### External Integrations (Evaluated Individually)

- **INTG-01**: Email delivery via Nodemailer SMTP (replaces PHP gateway)
- **INTG-02**: SMS notifications via Twilio API (replaces old gateway if kept)
- **INTG-03**: Bible API integration via API.Bible or similar service
- **INTG-04**: Agora Web SDK for live video workshops
- **INTG-05**: OpenAI Moderation API for automated content flagging (optional)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Shop / E-commerce | Not part of Free Luma's core value proposition; adds complexity of payment processing, inventory, shipping |
| Redeem codes / physical product tie-ins | ZOX-specific feature; Free Luma is digital-only platform |
| User-created groups (ZOX-style) | Free Luma uses admin-defined categories instead of user-generated groups; simpler moderation and structure |
| Mobile native app (iOS/Android) | Web-first strategy with responsive mobile design; native app deferred until web version proves PMF |
| OAuth/SSO login (Google, Facebook) | Email/password authentication sufficient for v1; OAuth adds complexity and external dependencies |
| Real-time video calls outside workshops | Workshop-only video keeps scope contained; 1:1 video calls are separate product category |
| Algorithmic "For You" feed as default | Faith communities value intentional connection; chronological feed aligns with values; algorithm requires ML infrastructure |
| Public vanity metrics (follower counts visible to all) | Creates comparison culture; metrics visible only to profile owner (like theWell approach) |
| Open creator registration for workshop hosts | Quality control requires invite/application-based creator program; prevents low-quality or doctrinally problematic content |
| Anonymous posting | Creates moderation nightmares; faith community requires accountability; privacy via "followers-only" instead |
| Donation / tithing / payment features | Moves platform into fintech with regulatory compliance, security liability; partner with existing giving platforms instead |
| Full church management suite | Massive scope creep; competing with established platforms (Faithlife, Planning Center, Pushpay); stay focused on content + community |
| AI-generated daily devotional content | Faith communities value human authenticity; AI content feels hollow; reputational risk if discovered |
| Marketplace for books, courses, merchandise | Turns community into storefront; creates pay-to-play dynamics; users distrust platforms that push purchases |
| Video editing tools | Out of core competency; users can edit externally before upload |
| Advanced analytics dashboard for regular users | Creator/host dashboard deferred to v2; regular users don't need detailed analytics |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| AUTH-08 | Phase 1 | Pending |
| AUTH-09 | Phase 1 | Pending |
| AUTH-10 | Phase 6 | Pending |
| PROF-01 | Phase 1 | Pending |
| PROF-02 | Phase 1 | Pending |
| PROF-03 | Phase 2 | Pending |
| PROF-04 | Phase 2 | Pending |
| PROF-05 | Phase 2 | Pending |
| PROF-06 | Phase 2 | Pending |
| PROF-07 | Phase 2 | Pending |
| PROF-08 | Phase 2 | Pending |
| PROF-09 | Phase 1 | Pending |
| DAILY-01 | Phase 1 | Pending |
| DAILY-02 | Phase 1 | Pending |
| DAILY-03 | Phase 1 | Pending |
| DAILY-04 | Phase 1 | Pending |
| DAILY-05 | Phase 1 | Pending |
| DAILY-06 | Phase 1 | Pending |
| DAILY-07 | Phase 2 | Pending |
| DAILY-08 | Phase 2 | Pending |
| DAILY-09 | Phase 2 | Pending |
| DAILY-10 | Phase 1 | Pending |
| FEED-01 | Phase 2 | Pending |
| FEED-02 | Phase 2 | Pending |
| FEED-03 | Phase 2 | Pending |
| FEED-04 | Phase 2 | Pending |
| FEED-05 | Phase 2 | Pending |
| FEED-06 | Phase 2 | Pending |
| FEED-07 | Phase 2 | Pending |
| FEED-08 | Phase 2 | Pending |
| FEED-09 | Phase 2 | Pending |
| FEED-10 | Phase 2 | Pending |
| FEED-11 | Phase 2 | Pending |
| FEED-12 | Phase 2 | Pending |
| FEED-13 | Phase 2 | Pending |
| FEED-14 | Phase 2 | Pending |
| PRAY-01 | Phase 2 | Pending |
| PRAY-02 | Phase 2 | Pending |
| PRAY-03 | Phase 2 | Pending |
| PRAY-04 | Phase 2 | Pending |
| PRAY-05 | Phase 2 | Pending |
| PRAY-06 | Phase 2 | Pending |
| PRAY-07 | Phase 2 | Pending |
| PRAY-08 | Phase 2 | Pending |
| PRAY-09 | Phase 2 | Pending |
| PRAY-10 | Phase 2 | Pending |
| CHAT-01 | Phase 3 | Pending |
| CHAT-02 | Phase 3 | Pending |
| CHAT-03 | Phase 3 | Pending |
| CHAT-04 | Phase 3 | Pending |
| CHAT-05 | Phase 3 | Pending |
| CHAT-06 | Phase 3 | Pending |
| CHAT-07 | Phase 3 | Pending |
| CHAT-08 | Phase 3 | Pending |
| CHAT-09 | Phase 3 | Pending |
| CHAT-10 | Phase 3 | Pending |
| NOTIF-01 | Phase 3 | Pending |
| NOTIF-02 | Phase 3 | Pending |
| NOTIF-03 | Phase 3 | Pending |
| NOTIF-04 | Phase 3 | Pending |
| NOTIF-05 | Phase 3 | Pending |
| NOTIF-06 | Phase 3 | Pending |
| NOTIF-07 | Phase 3 | Pending |
| NOTIF-08 | Phase 3 | Pending |
| NOTIF-09 | Phase 3 | Pending |
| NOTIF-10 | Phase 1 | Pending |
| NOTIF-11 | Phase 3 | Pending |
| NOTIF-12 | Phase 3 | Pending |
| NOTIF-13 | Phase 3 | Pending |
| NOTIF-14 | Phase 3 | Pending |
| CONT-01 | Phase 2 | Pending |
| CONT-02 | Phase 2 | Pending |
| CONT-03 | Phase 2 | Pending |
| CONT-04 | Phase 2 | Pending |
| CONT-05 | Phase 4 | Pending |
| CONT-06 | Phase 4 | Pending |
| CONT-07 | Phase 4 | Pending |
| CONT-08 | Phase 4 | Pending |
| CONT-09 | Phase 4 | Pending |
| CONT-10 | Phase 4 | Pending |
| CONT-11 | Phase 4 | Pending |
| CONT-12 | Phase 4 | Pending |
| SOCL-01 | Phase 2 | Pending |
| SOCL-02 | Phase 2 | Pending |
| SOCL-03 | Phase 2 | Pending |
| SOCL-04 | Phase 2 | Pending |
| SOCL-05 | Phase 2 | Pending |
| SOCL-06 | Phase 2 | Pending |
| SOCL-07 | Phase 2 | Pending |
| SOCL-08 | Phase 2 | Pending |
| SOCL-09 | Phase 2 | Pending |
| SOCL-10 | Phase 2 | Pending |
| SOCL-11 | Phase 2 | Pending |
| SOCL-12 | Phase 2 | Pending |
| SOCL-13 | Phase 2 | Pending |
| SOCL-14 | Phase 2 | Pending |
| SOCL-15 | Phase 2 | Pending |
| SETT-01 | Phase 4 | Pending |
| SETT-02 | Phase 1 | Pending |
| SETT-03 | Phase 1 | Pending |
| SETT-04 | Phase 4 | Pending |
| SETT-05 | Phase 4 | Pending |
| SETT-06 | Phase 4 | Pending |
| SETT-07 | Phase 4 | Pending |
| SETT-08 | Phase 4 | Pending |
| SETT-09 | Phase 4 | Pending |
| SETT-10 | Phase 4 | Pending |
| SETT-11 | Phase 4 | Pending |
| SETT-12 | Phase 4 | Pending |
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 1 | Pending |
| UI-04 | Phase 1 | Pending |
| UI-05 | Phase 1 | Pending |
| UI-06 | Phase 1 | Pending |
| UI-07 | Phase 1 | Pending |
| UI-08 | Phase 1 | Pending |
| UI-09 | Phase 1 | Pending |
| UI-10 | Phase 1 | Pending |
| UI-11 | Phase 1 | Pending |
| UI-12 | Phase 1 | Pending |
| UI-13 | Phase 1 | Pending |
| UI-14 | Phase 1 | Pending |
| UI-15 | Phase 1 | Pending |
| CAT-01 | Phase 2 | Pending |
| CAT-02 | Phase 2 | Pending |
| CAT-03 | Phase 2 | Pending |
| CAT-04 | Phase 2 | Pending |
| CAT-05 | Phase 2 | Pending |
| CAT-06 | Phase 2 | Pending |
| MOD-01 | Phase 2 | Pending |
| MOD-02 | Phase 2 | Pending |
| MOD-03 | Phase 4 | Pending |
| MOD-04 | Phase 4 | Pending |
| MOD-05 | Phase 2 | Pending |
| MIG-01 | Phase 6 | Pending |
| MIG-02 | Phase 6 | Pending |
| MIG-03 | Phase 6 | Pending |
| MIG-04 | Phase 6 | Pending |
| MIG-05 | Phase 6 | Pending |
| MIG-06 | Phase 6 | Pending |
| MIG-07 | Phase 6 | Pending |
| MIG-08 | Phase 6 | Pending |
| MIG-09 | Phase 6 | Pending |
| MIG-10 | Phase 6 | Pending |
| TECH-01 | Phase 1 | Pending |
| TECH-02 | Phase 1 | Pending |
| TECH-03 | Phase 1 | Pending |
| TECH-04 | Phase 1 | Pending |
| TECH-05 | Phase 3 | Pending |
| TECH-06 | Phase 1 | Pending |
| TECH-07 | Phase 1 | Pending |
| TECH-08 | Phase 3 | Pending |
| TECH-09 | Phase 1 | Pending |
| TECH-10 | Phase 1 | Pending |
| TECH-11 | Phase 1 | Pending |
| TECH-12 | Phase 1 | Pending |
| TECH-13 | Phase 1 | Pending |
| TECH-14 | Phase 1 | Pending |
| TECH-15 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 165 total
- Mapped to phases: 165 (100% coverage)
- Phase 1 (Foundation): 48 requirements
- Phase 2 (Core Social): 57 requirements
- Phase 3 (Real-Time): 26 requirements
- Phase 4 (Enhanced Content): 22 requirements
- Phase 5 (Workshops): 0 requirements (v2 deferred)
- Phase 6 (Migration & Launch): 12 requirements

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 after roadmap creation with complete phase traceability*
