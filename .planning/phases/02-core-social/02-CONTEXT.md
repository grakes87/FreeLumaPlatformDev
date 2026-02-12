# Phase 2: Core Social - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete social platform functionality — users can create posts (with multi-media), follow others, engage with content via reactions/comments, use the prayer wall, search for users, and access their profile. Social feed and prayer wall are completely separate content streams. Content is mode-isolated (bible/positivity) with admin toggle for social feed cross-mode visibility.

</domain>

<decisions>
## Implementation Decisions

### Post Creation
- Text + multiple images + multiple videos (no Bible verse card attachment)
- Up to 10 media items per post (mix of images and videos)
- Media displayed as horizontal swipeable carousel (like Instagram)
- Text supports @mentions (linked to profiles) and #hashtags (styled but not tappable yet)
- No bold/italic/rich formatting — plain text with parsed mentions and hashtags
- Long-form text allowed (2000+ characters)
- No file size limits on uploads — server-side compression after upload
- Max video duration: 5 minutes
- Videos auto-play muted when scrolled into view
- Full-screen composer UI (slides up when tapping center '+')
- Auto-save draft if user navigates away mid-compose
- No time limit on edit/delete — users can edit or delete their posts anytime
- Profanity filter: allow posting but flag for admin review

### Content Separation
- Social feed posts and prayer wall posts are completely separate content streams
- No crossover — prayer posts only on prayer wall, feed posts only in social feed
- Exception: prayer requests CAN be quote-reposted to the social feed

### Create Flow (Center '+' Button)
- New elevated '+' button added to center of bottom navigation
- Tapping '+' shows quick picker overlay: "Feed Post" or "Prayer Request"
- Defaults based on current section (prayer wall → prayer request, feed → feed post)
- Opens full-screen composer after type selection

### Bottom Navigation Update
- Order: Daily | Prayer | Feed | **(+)** | Studies | Animations | Profile
- '+' button is elevated/raised from the navigation bar
- All existing tabs remain; '+' is inserted in center position
- Animations tab still bible-only (hidden for positivity mode)
- Prayer wall tab hidden for positivity mode (prayer wall is bible-only for now)

### Feed Layout & Behavior
- Two feed modes: **FYP (For You)** as default + **Following** toggle
- FYP shows all public posts with TikTok-style recommendation algorithm (engagement signals + recency + interaction history)
- Following shows only posts from followed users
- Sticky FYP/Following tabs under the top bar
- No category filters on the feed
- Pull-to-refresh (no "new posts" banner indicator)
- Text truncated at ~5 lines with "Read more" to expand
- User search bar at top of feed page (user search only, no post search)

### Dual Feed Style (Admin-Toggled)
- **TikTok-style** (default): Full-screen vertical swipe, one post at a time, snap-to-post
  - Text-only posts: centered text on gradient background (like Facebook Stories)
  - Reaction/comment/bookmark/repost buttons: right side vertical stack (like TikTok)
- **Instagram-style**: Card-based scrollable feed with shadows and rounded corners
- Admin toggles between styles from admin settings dashboard
- Both styles support the same content and interactions

### Reactions System
- Same 6 reactions across the entire platform (daily content, feed posts, prayer wall, comments):
  - 👍 Like, ❤️ Love, 😂 Haha, 😮 Wow, 😢 Sad, 🙏 Pray
- Long-press/tap to access reaction picker
- All engagement counts (reactions, comments, reposts) shown publicly on posts

### Comments
- Threaded comments — 2 levels deep (comment → reply → reply-to-reply, then flat)
- Same 6 emoji reactions on comments
- Comments displayed in bottom sheet (slide-up over feed)
- Top 1-2 comments previewed on post card with "View all X comments" link
- Comments support same profanity filter (flag for review)

### Repost System
- No external sharing (social feed is members-only)
- Quote repost only: user adds their own comment above the embedded original post
- Reposts appear on the user's profile under "Reposts" tab

### Post Card (Instagram mode)
- Header: author avatar + display name + relative timestamp
- '...' context menu: Bookmark, Report, Block User (and Edit/Delete for own posts)

### Bookmarks
- Simple save — one "Saved" list, no folders
- Bookmark icon on posts (not on prayer requests)
- Saved posts accessible from "Saved" tab on user's own profile

### User Search
- Search bar at top of feed page
- User search only (no post/content search for now)
- Results show: avatar + display name + @username + Follow button
- Search respects mode isolation (when enabled)

### Mode Isolation
- **Daily content**: Always mode-isolated (bible/positivity) — NOT toggleable
- **Social feed**: Mode-isolated by default — admin toggle to merge (immediate merge when toggled)
- **Prayer wall**: Bible-mode only for now; admin can configure per-category visibility for future categories
- **Follows/discovery**: When isolation is on, users only see/find/follow same-mode users
- When admin toggles off social isolation, content immediately merges across modes

### Prayer Wall
- Always card-based layout (not affected by admin feed style toggle)
- Liquid glass card styling — matches existing daily content aesthetic
- Two tabs: **Others' Prayers** (community) and **My Prayers**
  - My Prayers has two sub-sections: "My Requests" and "Prayers I've Joined"
- Prayer wall shows all public prayers (no FYP/Following split)
- Engagement-weighted sort (recency + prayer count)
- Prayer wall is bible-mode only (hidden in positivity mode); future categories may get prayer walls
- Admin toggle: combined prayer wall across categories or keep separate

### Prayer Requests
- Same media support as feed posts (up to 10 images/videos, carousel)
- Same text rules: @mentions (linked), #hashtags (styled, not tappable), 2000+ chars
- Option to post anonymously (author sees themselves, everyone else sees "Anonymous")
- "Praying for you" — single tap toggle, shows count ("23 praying")
- Author can see WHO prayed (tap count to view list)
- Full comment support (threaded, same as feed)
- Same 6 emoji reactions + dedicated pray toggle
- "Answered" badge stays in feed (doesn't move to separate section)
- Same profanity filter as feed (flag for review)
- Same '...' context menu (Report, Block, Edit/Delete/Mark Answered for author)
- Can be quote-reposted to the social feed
- No bookmarks on prayer requests
- No expiry — stay until marked answered or deleted
- Edit and delete with no time limit

### Follow System
- Public profiles: instant follow
- Private profiles: follow request requiring approval
- Profiles default to public
- "Requested" state for pending follow requests (tap again to cancel)
- Remove follower option (without blocking)

### Profile
- Instagram-style header: avatar, name, bio, stats row (posts/followers/following), Follow button
- Three tabs: Posts, Reposts, Saved (saved only visible on own profile)
- Private profile shows: name, avatar, bio, follower count, following count (posts/tabs hidden for non-followers)
- Follower/following lists visible only if profile is public or you follow them
- Dedicated "Edit Profile" page with fields: display name, username, bio, avatar, privacy (public/private), date of birth, location, website link, account mode

### Blocking
- Block hides everything: blocked user's posts, comments, reactions disappear from blocker's view; blocker disappears from blocked user's view
- Auto-unfollow both directions on block
- Blocked users list managed from profile settings

### Reporting
- Report reasons: Spam, Harassment, Hate speech, Inappropriate content, Self-harm, Other
- Reports feed into admin moderation queue

### Content Moderation
- AI moderation: auto-hide content scoring high confidence, flag borderline for admin review
- Profanity filter: flag for admin review (doesn't block posting)
- Full admin moderation queue UI with approve/remove actions

### Admin Dashboard
- Separate (admin) route group within the same Next.js codebase (shares models, DB, utilities)
- Protected by withAdmin middleware
- Detailed analytics: user growth charts, engagement trends, content volume over time
- Moderation queue: reported/flagged content with approve/remove/reason logging
- Platform settings: feed style toggle (TikTok/Instagram), search toggle, registration mode (open/invite), maintenance mode
- Content settings: profanity filter sensitivity, AI moderation sensitivity, default user mode
- Mode isolation toggle (social feed cross-mode visibility)
- Prayer wall per-category visibility toggles

### Follow Suggestions
- Mixed algorithm: popular users + interest-based (shared categories from onboarding) + new users
- Shown in Following tab empty state and other discovery surfaces

### Claude's Discretion
- TikTok recommendation algorithm specifics (weighting, signals, decay)
- Loading skeletons and transition animations
- Exact gradient backgrounds for text-only posts in TikTok mode
- AI moderation provider/approach (OpenAI Moderation API, custom, etc.)
- Server-side media compression approach
- Admin dashboard chart library and layout
- Comment pagination and loading behavior
- Draft auto-save storage mechanism (localStorage vs API)
- Search debounce timing and UX
- Follow suggestion ranking weights
- Profanity filter library/sensitivity defaults

</decisions>

<specifics>
## Specific Ideas

- Feed style inspired by TikTok (full-screen swipe) as default, with Instagram (card) as admin-selectable alternative
- Reactions consistent across entire platform — same 6 emoji set from daily content (👍❤️😂😮😢🙏)
- Prayer cards use liquid glass aesthetic matching existing daily content UI
- Text-only posts in TikTok mode use centered text on gradient backgrounds (like Facebook Stories)
- Action buttons in TikTok mode positioned as right-side vertical stack (like TikTok)
- "I want the admin to be able to toggle feed style, search, mode isolation from a dashboard"
- Prayer wall is a faith-community feature — bible-mode only, with future category expansion possible
- No external sharing — content is members-only; reposting within the platform via quote reposts

</specifics>

<deferred>
## Deferred Ideas

- Hashtag feeds (tapping a hashtag to see all posts with that tag) — future enhancement
- Post search / content search — future enhancement (user search only for Phase 2)
- Additional content categories beyond bible/positivity — future planning
- Scheduled/timed prayer walls — potential future feature

</deferred>

---

*Phase: 02-core-social*
*Context gathered: 2026-02-12*
