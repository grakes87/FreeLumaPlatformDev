# Feature Research

**Domain:** Faith-based social platform (daily inspirational content + community)
**Researched:** 2026-02-11
**Confidence:** MEDIUM-HIGH

Research based on analysis of: Faithlife, YouVersion, Pray.com, Glorify, ActsSocial, theWell, Hallow, FaithCircle, Gatherly, and general social platform best practices for 2026.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

#### Content & Scripture Foundation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Daily content feed (Bible verses / positivity posts) | Core value proposition of Free Luma; every faith app (YouVersion, Glorify, Pray.com) delivers daily content | MEDIUM | Requires content scheduling system, timezone handling, and content creation pipeline. This is the "heartbeat" of the app. |
| Multiple Bible translations | YouVersion offers 3,650+ versions; ActsSocial offers 7; users expect choice | LOW | Integrate a Bible API (e.g., API.Bible). Don't build your own Bible database. |
| Social feed (posts from followed users/creators) | Universal social platform expectation; every competitor has this | HIGH | The news feed is architecturally complex: ordering, caching, pagination, mixed media. Plan for algorithmic + chronological toggle. |
| Content cards with rich media | Standard in 2026 mobile-first apps; aligns with card-based ZOX-inspired design | MEDIUM | Support text, images, video embeds, and Bible verse cards. Cards are the atomic UI unit. |

#### User Identity & Social Graph

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| User profiles (bio, avatar, customizable fields) | Non-negotiable for any social platform | MEDIUM | Include faith-specific fields (denomination, church, testimony). Privacy controls essential. |
| Follow/follower system | Core social mechanic; users expect to curate their feed | MEDIUM | Asymmetric follow (like Twitter/Instagram), not mutual friendship (like Facebook). Simpler to build, better for content creators. |
| User search & discovery | Users need to find people, content, and communities | MEDIUM | Search across users, posts, prayer requests, workshops. Full-text search required. |

#### Communication

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Push notifications | 2026 expectation; every faith app uses them for daily engagement | MEDIUM | Critical for retention. Daily devotional reminder is the #1 re-engagement hook. Support notification preferences/timing controls. |
| Direct messaging / chat | Universal social expectation; FaithCircle, ActsSocial, theWell all have it | HIGH | Real-time messaging with WebSockets. Start with 1:1 chat, extend to group. End-to-end encryption is ideal but adds significant complexity. |
| In-app notifications (activity feed) | Users expect to know when someone interacts with their content | LOW-MEDIUM | Likes, comments, follows, prayer responses. Standard notification center pattern. |

#### Prayer & Faith-Specific

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Prayer wall / prayer requests | Table stakes for faith platforms. ActsSocial, Pray.com, Gatherly, and nearly every competitor has this. | MEDIUM | Public and private prayer requests. "Praying for you" interaction (like a specialized "like"). Notification when someone prays for your request. |
| Prayer response notifications ("Someone prayed for you") | ActsSocial pioneered this; users love the confirmation that others are praying | LOW | Lightweight interaction (tap to pray) with notification to requester. High emotional value, low implementation cost. |

#### Content Consumption & Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Bookmarks / save for later | Standard across all social and content platforms in 2026 | LOW | Simple save-to-collection functionality. Organize by folders/tags. |
| Notes (personal annotations) | YouVersion has this; users expect to journal alongside content | LOW-MEDIUM | Text notes attached to posts, verses, or workshops. Keep private by default with option to share. |
| Video library (on-demand content) | Pray.com, Faithlife TV, and YouVersion all offer video libraries | MEDIUM | Catalog of past workshops, sermons, teaching content. Requires video hosting/streaming infrastructure. |

#### Content Interaction

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Likes / reactions on posts | Universal social expectation | LOW | Consider faith-themed reactions (pray, amen, heart) instead of generic likes. |
| Comments on posts | Universal social expectation | MEDIUM | Threaded comments with moderation. Content moderation is critical in faith spaces. |
| Share / repost functionality | Standard social feature | LOW | Share to feed, share externally (deep links, social media). Verse image sharing like YouVersion. |

### Differentiators (Competitive Advantage)

Features that set Free Luma apart. Not required, but create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Live workshops (video) with scheduling & booking | Most faith apps are content-only. Live interactive workshops create real community. Pray.com has some live content but not interactive workshops. | HIGH | This is Free Luma's biggest differentiator. Video conferencing + scheduling + RSVP + reminders. Consider WebRTC or third-party (Agora, LiveKit). Distinct from passive video library. |
| Creator/host tools (workshop management) | Empowers content creators to build and host workshops. Most competitors are platform-curated only. | HIGH | Dashboard for hosts: create workshops, set schedule, manage attendees, view analytics. Two-sided marketplace dynamic. |
| Curated daily content with editorial voice | YouVersion is algorithmic; Pray.com uses celebrity narrators. A consistent, personal editorial voice creates intimacy. | LOW-MEDIUM | Human-curated daily posts with a distinct voice/brand. Not AI-generated. This is a brand differentiator more than a tech one. |
| Workshop notes (collaborative/personal) | Taking notes during live workshops bridges live and async experience. No competitor does this well. | MEDIUM | Real-time note-taking during workshops. Notes persist with the workshop recording. Personal + shared notes. |
| Integrated content journey (daily post to workshop to community) | Most competitors are fragmented: YouVersion = Bible, Pray.com = prayer, ActsSocial = social. Free Luma connects content consumption to live experience to community in one flow. | MEDIUM | UX design challenge more than technical. The card-based UI should create a natural flow: read daily post -> see related workshop -> join discussion -> submit prayer. |
| Card-based mobile-first UX (ZOX-inspired) | Clean, swipeable, focused interface. Most faith apps have dated or cluttered UIs. | MEDIUM | Differentiator is in design execution, not feature. Cards as atomic unit: post cards, prayer cards, workshop cards, verse cards. Swipe navigation. |
| Faith-themed reactions & interactions | Generic likes feel secular. "Amen," "Praying," and faith-specific reactions create belonging. | LOW | Small touch with outsized emotional impact. ActsSocial has "praying for you" but no one has a full faith-reaction system. |
| Streak / engagement tracking (spiritual habits) | YouVersion tracks reading streaks. Glorify tracks devotional habits. Habit formation drives retention. | LOW-MEDIUM | Daily check-in streaks, prayer streaks, workshop attendance tracking. Gamification lite -- not leaderboards, but personal growth tracking. |
| Content creator profiles with portfolio | Distinguish workshop hosts and post authors from regular users. Enable discovery of creators. | MEDIUM | Creator verification, workshop history, follower count, upcoming schedule. Helps users find and follow their favorite teachers/hosts. |
| Offline access for saved content | Glorify and YouVersion both support offline. Essential for users in areas with spotty connectivity. | MEDIUM | Cache daily devotionals, saved posts, and bookmarked content. PWA service worker strategy. |

### Anti-Features (Deliberately NOT Build)

Features that seem good but create problems for a faith-based platform.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Algorithmic "For You" discovery feed (as primary feed) | Every major platform has one; seems modern | Faith communities value intentional connection over algorithmic discovery. Algorithm-driven feeds create filter bubbles and outrage-optimization. Massive ML infrastructure cost for a smaller platform. | Chronological feed as default with optional "Discover" tab for finding new creators/content. Let users control their experience. |
| Public follower/like counts | Standard social metric; seems expected | theWell deliberately hides these. Vanity metrics create comparison culture, which contradicts faith values. Leads to performative posting. | Show follow/like counts only to the content creator (private analytics). Public-facing profile shows content, not metrics. |
| Open registration for content creators/workshop hosts | Scales content supply quickly | Unvetted creators post low-quality or doctrinally problematic content. Moderation nightmare. Dilutes brand trust. | Invite-only or application-based creator program. Curate quality over quantity. Expand gradually. |
| Real-time "everything" (live typing indicators, online status, read receipts) | Feels modern and responsive | Creates social pressure and anxiety. Users feel obligated to respond immediately. Significant infrastructure cost for WebSocket connections at scale. | Deliver messages in real-time but omit typing indicators and read receipts. Show "recently active" instead of live online status. |
| Donation / tithing features | Churches want it; seems like natural fit | Moves Free Luma into fintech territory with regulatory, security, and liability implications. Competes with established church management platforms (Pushpay, Planning Center). | Partner with or link out to established giving platforms. Don't handle money directly. |
| AI-generated daily content | Scales content creation cheaply | Faith communities deeply value authenticity. AI-generated devotionals feel hollow and inauthentic. Reputational risk if discovered. | Use AI as a tool for content creators (suggestions, formatting) but keep human authorship front and center. Always disclose AI assistance. |
| Full church management suite (attendance, volunteer scheduling, etc.) | Churches are a natural audience | Massive scope creep. Competing with Faithlife, Planning Center, Pushpay on their home turf. Completely different product category. | Stay focused on content + community. Integrate with church management platforms via API rather than rebuilding them. |
| Anonymous posting | Encourages vulnerability for sensitive prayer requests | Anonymous features get abused (trolling, inappropriate content). Moderation becomes nearly impossible. | Allow "friends only" or "private" prayer requests visible to a trusted circle. Identity stays intact but audience is controlled. |
| Marketplace / e-commerce (selling books, courses, merch) | Monetization opportunity | Turns a community into a storefront. Creates pay-to-play dynamics. Users distrust platforms that push purchases. | If needed later, keep commerce separate from the social experience. Link out to external stores. |

---

## Feature Dependencies

```
[User Auth & Profiles]
    |
    +--requires--> [Follow System]
    |                  |
    |                  +--requires--> [Social Feed]
    |                  |                  |
    |                  |                  +--enhances--> [Push Notifications]
    |                  |                  +--enhances--> [Activity Notifications]
    |                  |
    |                  +--enhances--> [User Search & Discovery]
    |
    +--requires--> [Daily Content System]
    |                  |
    |                  +--requires--> [Content Cards UI]
    |                  +--enhances--> [Push Notifications] (daily reminders)
    |                  +--enhances--> [Bookmarks]
    |                  +--enhances--> [Notes]
    |
    +--requires--> [Prayer Wall]
    |                  |
    |                  +--requires--> [Prayer Interactions] ("praying for you")
    |                  +--enhances--> [Push Notifications]
    |
    +--requires--> [Chat / Messaging]
    |                  |
    |                  +--enhances--> [Workshop Live Chat]
    |
    +--requires--> [Video Infrastructure]
                       |
                       +--requires--> [Video Library] (on-demand)
                       +--requires--> [Live Workshops]
                                          |
                                          +--requires--> [Workshop Scheduling & Booking]
                                          +--requires--> [Creator/Host Tools]
                                          +--enhances--> [Workshop Notes]
                                          +--enhances--> [Chat / Messaging] (workshop chat)

[Likes/Reactions] --enhances--> [Social Feed], [Prayer Wall]
[Comments] --enhances--> [Social Feed], [Prayer Wall]
[Share] --enhances--> [Social Feed], [Daily Content]
[Bookmarks] --enhances--> [Social Feed], [Video Library], [Daily Content]
[Notes] --enhances--> [Daily Content], [Video Library], [Live Workshops]
```

### Dependency Notes

- **User Auth & Profiles is the foundation:** Everything depends on identity. Build first.
- **Follow System requires Profiles:** Can't follow without user identity. Feed depends on follows.
- **Social Feed requires Follow System:** Feed content is determined by who you follow. This is the core loop.
- **Daily Content System requires Auth:** Need to track what users have seen, personalize delivery.
- **Prayer Wall requires Auth:** Prayer requests are personal; need identity for "praying for you" interactions.
- **Live Workshops require Video Infrastructure:** Cannot do live workshops without video streaming capability. This is the highest-complexity dependency chain.
- **Creator/Host Tools require Live Workshops:** Host tools are meaningless without the workshop system.
- **Workshop Notes enhance Live Workshops:** Notes are optional but significantly enhance the live workshop experience.
- **Chat enhances Workshops:** Workshop-specific chat channels require the messaging system.
- **Push Notifications enhance everything:** Cross-cutting concern; implement the notification system early and connect features to it incrementally.

---

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the core value proposition of "daily inspiration + community connection."

- [ ] **User auth & profiles** -- Foundation for everything. Email + social login. Basic profile with avatar, bio, denomination.
- [ ] **Daily content feed** -- The core hook. Curated daily Bible verse / positivity post delivered to all users. This is why people download the app.
- [ ] **Social feed** -- Chronological feed of posts from followed users. Support text + image + Bible verse posts.
- [ ] **Follow system** -- Asymmetric follows. Follow creators and other users to curate your feed.
- [ ] **Prayer wall** -- Public prayer requests with "praying for you" interaction. High emotional engagement, moderate technical complexity.
- [ ] **Push notifications** -- Daily devotional reminder + activity notifications (new follower, prayer response, comment).
- [ ] **Likes/reactions & comments** -- Basic engagement mechanics on posts and prayer requests.
- [ ] **Bookmarks** -- Save posts and verses for later. Simple but expected.
- [ ] **User search** -- Find users and content. Basic full-text search.
- [ ] **Content cards UI** -- Mobile-first, card-based layout. This IS the brand.

### Add After Validation (v1.x)

Features to add once core engagement loop is proven (users returning daily, posting, praying for each other).

- [ ] **Direct messaging / chat** -- Add once community forms and users want private conversation. Trigger: users requesting DMs or sharing contact info in comments.
- [ ] **Notes** -- Personal annotations on posts and verses. Trigger: users bookmarking heavily and wanting to add context.
- [ ] **Video library** -- On-demand video content. Trigger: having enough recorded content to justify a library experience.
- [ ] **In-app activity feed** -- Consolidated notification center. Trigger: engagement volume makes push-only insufficient.
- [ ] **Share to external platforms** -- Verse images, post sharing to social media. Trigger: organic sharing behavior observed.
- [ ] **Engagement streaks** -- Daily check-in tracking. Trigger: users already returning daily and wanting to track progress.
- [ ] **Faith-themed reactions** -- Expand beyond simple like to amen, pray, heart. Trigger: community culture established enough to define reaction vocabulary.

### Future Consideration (v2+)

Features to defer until product-market fit is established and user base warrants the investment.

- [ ] **Live workshops (video)** -- Highest complexity, highest differentiation. Defer until community is active and there's creator supply. Requires video infrastructure investment.
- [ ] **Workshop scheduling & booking** -- Depends on live workshops existing.
- [ ] **Creator/host tools** -- Dashboard for workshop hosts. Requires creator program to be established.
- [ ] **Workshop notes** -- Collaborative notes during live sessions.
- [ ] **Offline access** -- PWA caching for saved content. Defer until mobile usage patterns are understood.
- [ ] **Creator profiles & portfolio** -- Enhanced profiles for verified content creators.
- [ ] **Advanced discovery** -- Recommended content, trending topics, suggested follows.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| User auth & profiles | HIGH | MEDIUM | P1 |
| Daily content feed | HIGH | MEDIUM | P1 |
| Social feed | HIGH | HIGH | P1 |
| Follow system | HIGH | MEDIUM | P1 |
| Prayer wall | HIGH | MEDIUM | P1 |
| Push notifications | HIGH | MEDIUM | P1 |
| Likes/reactions & comments | HIGH | LOW-MEDIUM | P1 |
| Bookmarks | MEDIUM | LOW | P1 |
| User search | MEDIUM | MEDIUM | P1 |
| Content cards UI | HIGH | MEDIUM | P1 |
| Direct messaging / chat | HIGH | HIGH | P2 |
| Notes | MEDIUM | LOW-MEDIUM | P2 |
| Video library | MEDIUM | MEDIUM | P2 |
| Activity feed (in-app) | MEDIUM | LOW-MEDIUM | P2 |
| External sharing | MEDIUM | LOW | P2 |
| Engagement streaks | MEDIUM | LOW | P2 |
| Faith-themed reactions | LOW-MEDIUM | LOW | P2 |
| Live workshops (video) | HIGH | HIGH | P3 |
| Workshop scheduling | HIGH | MEDIUM | P3 |
| Creator/host tools | HIGH | HIGH | P3 |
| Workshop notes | MEDIUM | MEDIUM | P3 |
| Offline access | MEDIUM | MEDIUM | P3 |
| Creator profiles | MEDIUM | MEDIUM | P3 |
| Advanced discovery | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (validates core value proposition)
- P2: Should have, add after core engagement proven
- P3: Major investment features, defer until PMF established

---

## Competitor Feature Analysis

| Feature | YouVersion | Pray.com | Faithlife | ActsSocial | Glorify | theWell | Free Luma Approach |
|---------|-----------|---------|----------|-----------|--------|--------|-------------------|
| Daily devotional content | Reading plans, verse of the day | Daily prayers, bedtime stories | Study Bible, notes | Prayer feeds | Daily quotes, devotionals | Daily "Dove" feature | Curated daily posts with editorial voice |
| Bible integration | 3,650+ versions, deep | Scripture readings | Study Bible (premium) | 7 translations | Multiple translations | Basic | API-integrated, multiple translations |
| Social feed | Limited (community tab) | Limited | Group-based | Full social feed | Community sharing | Short-form video feed | Full chronological feed with cards |
| Prayer features | Prayer lists, shared prayers | Community prayer wall | Group prayer | Public/private prayer walls, notifications | Community prayers | Prayer requests | Prayer wall with "praying for you" notifications |
| Live video | No | Some live content | Church live streaming | No | No | No | Live interactive workshops (differentiator) |
| Video library | Partner video content | Premium audio/video | Faithlife TV | No | Audio journeys | Short videos | On-demand workshop recordings |
| Chat / messaging | No | Group discussions | Group chat | Direct messaging | No | Direct messaging | 1:1 and group messaging |
| Follow system | Friends | Community groups | Groups | Follow creators | Community | Follow | Asymmetric follow |
| Bookmarks/saves | Bookmarks, highlights | Favorites | Library | No | Journal | Saves | Bookmarks with folders |
| Notes | Public/private notes | No | Study notes (premium) | No | Journal | No | Personal notes on content |
| Push notifications | Daily verse, plan reminders | Daily prayer reminders | Group activity | Prayer notifications | Daily reminders | Daily engagement | Customizable daily reminders |
| User profiles | Basic | Basic | Detailed (church-linked) | Creator-friendly | Basic | Basic | Faith-specific with creator tiers |
| Monetization | Free (donation-funded) | Freemium ($70/yr premium) | Freemium (Logos premium) | Free | Freemium ($70/yr) | Free | TBD |
| Offline access | Yes | Premium only | Yes (Logos) | No | Premium only | No | Planned (v2) |

---

## Key Strategic Insights

### 1. The "Daily Hook" Pattern is Universal
Every successful faith app has a daily engagement hook: YouVersion has Verse of the Day, Pray.com has daily prayers, Glorify has daily devotionals. Free Luma's daily posts are correctly positioned as the core engagement driver. This must be flawless at launch.

### 2. Prayer is the Killer Social Feature
Prayer requests create the most emotionally resonant interactions in faith platforms. The "someone prayed for you" notification (pioneered by ActsSocial) has disproportionate engagement impact relative to implementation cost. Prioritize prayer wall quality.

### 3. Live Video Workshops are Genuinely Differentiating
No major faith-focused social platform does interactive live workshops well. Pray.com has some live content, and Faithlife streams church services, but neither offers bookable, interactive workshops with hosts. This is Free Luma's biggest opportunity -- but also its biggest technical challenge. The recommendation is to nail the social + content foundation first, then layer workshops on top.

### 4. Hide Vanity Metrics
theWell's approach of hiding follower counts, likes, and views is gaining traction. Faith communities are especially sensitive to comparison culture. Showing metrics privately to creators while hiding them publicly aligns with faith values and differentiates from secular social platforms.

### 5. Content Curation > Algorithm
For a smaller platform, a human-curated editorial voice is more trustworthy and feasible than an algorithmic feed. YouVersion uses data-driven recommendations at massive scale; Free Luma should lean into personal curation and community-driven discovery instead.

### 6. Creator Gating Protects Brand
FaithMeet restricts posting to Churches/Ministries only. While that's too restrictive for Free Luma, an application-based creator program (for workshop hosts and featured post authors) protects content quality without requiring the moderation infrastructure of a fully open platform.

---

## Sources

- [faith.tools - Apps for Christians](https://faith.tools/?show-all=true) -- Comprehensive directory of faith apps
- [ActsSocial - Christian Social Media Platform](https://actssocial.com/) -- Competitor with prayer wall focus
- [ActsSocial - 7 Best Christian Social Media Apps for 2026](https://actssocial.com/blog/best-christian-social-media-apps) -- Competitor feature comparison
- [ActsSocial - Best Christian Prayer Apps in 2026](https://actssocial.com/blog/best-christian-prayer-apps) -- Prayer feature landscape
- [YouVersion](https://www.youversion.com/) -- Market leader for Bible engagement
- [YouVersion - 2025 Verse of the Year](https://www.youversion.com/news/youversion-announces-2025-verse-of-the-year) -- Engagement data
- [Pray.com - Wikipedia](https://en.wikipedia.org/wiki/Pray.com) -- Platform overview
- [Glorify - #1 Christian Devotional App](https://glorify-app.com/en) -- Devotional feature set
- [Faithlife](https://faithlife.com/) -- Community + Bible study platform
- [How to Make a Social Media App in 2026 - Techstack](https://tech-stack.com/blog/how-to-make-a-social-media-app-complete-guide-for-2025/) -- Essential social features
- [What Makes a Social Networking Platform Successful in 2026](https://socialengine.com/blog/what-makes-a-social-networking-platform-successful/) -- Platform success factors
- [Social Media Trends 2026 - Hootsuite](https://www.hootsuite.com/research/social-trends) -- 2026 trend analysis
- [Premier Christianity - YouVersion monetization stance](https://www.premierchristianity.com/opinion/we-would-make-billions-if-we-monetised-the-bible-app-heres-why-we-never-will/20447.article) -- Faith app monetization philosophy
- [theWell - App Store](https://apps.apple.com/us/app/thewell-christian-social-media/id1370790950) -- Anti-vanity-metrics approach

---
*Feature research for: Faith-based social platform (Free Luma)*
*Researched: 2026-02-11*
