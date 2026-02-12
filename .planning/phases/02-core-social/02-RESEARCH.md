# Phase 2: Core Social - Research

**Researched:** 2026-02-12
**Domain:** Social platform features (posts, feed, follow, reactions, comments, prayer wall, categories, moderation, bookmarks, sharing, profile enhancement)
**Confidence:** HIGH

## Summary

Phase 2 builds a full social platform layer on top of Phase 1's foundation (auth, profiles, daily content, database). The codebase already establishes strong, reusable patterns: separate tables per content type for reactions/comments (daily_reactions, daily_comments), withAuth/withOptionalAuth HOF middleware, Zod validation, optimistic update hooks, and presigned B2 upload flow. Phase 2 should replicate these patterns for posts rather than introduce new abstractions.

The core work divides into seven domains: (1) database schema for posts, follows, bookmarks, reports, blocks, and prayer-specific tables; (2) CRUD API routes following existing patterns; (3) feed assembly with cursor-based pagination; (4) social interactions (like/comment/follow/block/report); (5) prayer wall features; (6) category browsing and subscription; (7) profile enhancement with stats and public profiles. The only new npm dependency needed is `obscenity` for profanity filtering (MOD-05) and `react-intersection-observer` for infinite scroll. Everything else -- sharp for image optimization, B2/Cloudflare for CDN, Zod for validation, Sequelize for ORM, lucide-react for icons -- is already installed.

**Primary recommendation:** Follow the "separate tables" pattern from Phase 1 (post_reactions, post_comments mirroring daily_reactions, daily_comments). Use cursor-based pagination with compound (created_at, id) cursors for all feed endpoints. Add `react-intersection-observer` for infinite scroll triggering. Add `obscenity` for profanity filtering on submission.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sequelize | ^6.37.7 | ORM for MySQL models, migrations, associations | Already established; all Phase 1 models use it |
| zod | ^4.3.6 | Request validation with safeParse | Already used in all API routes |
| sharp | ^0.34.5 | Server-side image resize/optimize to WebP | Already installed for avatar crops; extend to post images |
| @aws-sdk/client-s3 | ^3.988.0 | Backblaze B2 storage via S3-compatible API | Already configured for presigned uploads |
| @aws-sdk/s3-request-presigner | ^3.988.0 | Generate presigned PUT URLs for direct uploads | Already used for avatar upload flow |
| lucide-react | ^0.563.0 | Icons (Heart, MessageSquare, Bookmark, Share2, Flag, etc.) | Already used throughout the app |
| next-themes | ^0.4.6 | Dark mode support | Already integrated |

### New Dependencies Needed
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| obscenity | latest | Profanity detection and censoring for user-generated content | MOD-05: Run on post/comment/prayer submission |
| react-intersection-observer | latest | Viewport detection for infinite scroll trigger | FEED-07: Trigger next page load when sentinel enters viewport |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| obscenity | @2toad/profanity | @2toad has multi-language but obscenity has better variant detection (elongated chars, Unicode substitution) |
| obscenity | bad-words | bad-words is simpler but less robust against circumvention attempts |
| react-intersection-observer | Native IntersectionObserver | Package provides useInView hook with React lifecycle integration; saves boilerplate |
| react-intersection-observer | Scroll event listener | IntersectionObserver is asynchronous/low-priority; scroll listeners block main thread |
| Separate reaction tables | Polymorphic reactions table | Separate tables match Phase 1 pattern, simpler queries, no type column needed |

**Installation:**
```bash
npm install obscenity react-intersection-observer
```

## Architecture Patterns

### Recommended New File Structure
```
src/
├── app/
│   ├── (app)/
│   │   ├── feed/page.tsx                    # Main feed (replace placeholder)
│   │   ├── prayer-wall/page.tsx             # Prayer wall (replace placeholder)
│   │   ├── profile/page.tsx                 # Own profile (enhance existing)
│   │   ├── profile/[username]/page.tsx      # Public profile view (NEW)
│   │   ├── bookmarks/page.tsx               # Bookmarks page (NEW)
│   │   ├── categories/page.tsx              # Category browse (NEW)
│   │   ├── categories/[slug]/page.tsx       # Category feed (NEW)
│   │   ├── post/[id]/page.tsx               # Post detail with full comments (NEW)
│   │   └── search/page.tsx                  # User search (NEW)
│   └── api/
│       ├── posts/route.ts                   # GET (feed), POST (create)
│       ├── posts/[id]/route.ts              # GET (detail), PUT (edit), DELETE
│       ├── post-reactions/route.ts          # GET counts, POST toggle
│       ├── post-comments/route.ts           # GET paginated, POST create
│       ├── post-comments/[id]/route.ts      # PUT edit, DELETE
│       ├── follows/route.ts                 # GET list, POST follow/unfollow
│       ├── follows/suggestions/route.ts     # GET follow suggestions
│       ├── bookmarks/route.ts               # GET list, POST toggle
│       ├── bookmarks/folders/route.ts       # GET/POST/PUT/DELETE folders
│       ├── prayer-requests/route.ts         # GET prayer wall, POST create
│       ├── prayer-requests/[id]/route.ts    # PUT (mark answered), DELETE
│       ├── prayer-requests/[id]/pray/route.ts # POST pray toggle
│       ├── reports/route.ts                 # POST report
│       ├── blocks/route.ts                  # GET list, POST toggle
│       ├── users/search/route.ts            # GET user search
│       └── users/[id]/profile/route.ts      # GET public profile
├── components/
│   ├── feed/
│   │   ├── PostCard.tsx                     # Post card component
│   │   ├── PostComposer.tsx                 # Create/edit post modal
│   │   ├── PostFeed.tsx                     # Feed with infinite scroll
│   │   ├── FeedFilters.tsx                  # Category filter + sort controls
│   │   ├── BibleVerseCard.tsx               # Bible verse embed for posts
│   │   └── EmptyFeedState.tsx               # Onboarding empty state
│   ├── social/
│   │   ├── FollowButton.tsx                 # Follow/unfollow toggle
│   │   ├── LikeButton.tsx                   # Like with optimistic update
│   │   ├── BookmarkButton.tsx               # Bookmark toggle
│   │   ├── ShareButton.tsx                  # Share menu (copy link + Web Share API)
│   │   ├── CommentSection.tsx               # Post comments (adapt from daily)
│   │   ├── UserSearchResult.tsx             # Search result card
│   │   └── ReportModal.tsx                  # Report reason selection
│   ├── prayer/
│   │   ├── PrayerCard.tsx                   # Prayer request card
│   │   ├── PrayerComposer.tsx               # Create prayer request
│   │   ├── PrayButton.tsx                   # "Praying for you" button
│   │   └── PrayerFilters.tsx                # Active/answered filter
│   ├── profile/
│   │   ├── ProfileStats.tsx                 # Posts/Comments/Groups stats
│   │   ├── ProfileTabs.tsx                  # Posts/Activity tabs
│   │   ├── PublicProfileCard.tsx            # Other user's profile card
│   │   ├── FollowList.tsx                   # Followers/following list
│   │   └── ProfilePrivacySettings.tsx       # Privacy controls
│   └── categories/
│       ├── CategoryGrid.tsx                 # Category tile grid
│       ├── CategoryCard.tsx                 # Single category tile
│       └── CategoryFeed.tsx                 # Category-specific feed
├── hooks/
│   ├── usePostReactions.ts                  # Mirror useReactions for posts
│   ├── usePostComments.ts                   # Mirror useComments for posts
│   ├── useFollow.ts                         # Follow state + toggle
│   ├── useBookmark.ts                       # Bookmark state + toggle
│   ├── useFeed.ts                           # Feed fetch with cursor pagination
│   ├── usePrayerWall.ts                     # Prayer feed fetch
│   ├── useUserSearch.ts                     # Debounced user search
│   └── useInfiniteScroll.ts                 # Generic infinite scroll hook wrapping useInView
└── lib/
    ├── db/
    │   ├── models/
    │   │   ├── Post.ts                      # Post model
    │   │   ├── PostReaction.ts              # Post reaction model
    │   │   ├── PostComment.ts               # Post comment model
    │   │   ├── Follow.ts                    # Follow relationship model
    │   │   ├── Bookmark.ts                  # Bookmark model
    │   │   ├── BookmarkFolder.ts            # Bookmark folder model
    │   │   ├── PrayerRequest.ts             # Prayer request model
    │   │   ├── PrayerSupport.ts             # "Praying for you" records
    │   │   ├── Report.ts                    # Report model
    │   │   ├── Block.ts                     # Block model
    │   │   └── index.ts                     # Updated with all new models + associations
    │   └── migrations/
    │       ├── 016-create-posts.cjs
    │       ├── 017-create-post-reactions.cjs
    │       ├── 018-create-post-comments.cjs
    │       ├── 019-create-follows.cjs
    │       ├── 020-create-bookmarks.cjs
    │       ├── 021-create-bookmark-folders.cjs
    │       ├── 022-create-prayer-requests.cjs
    │       ├── 023-create-prayer-supports.cjs
    │       ├── 024-create-reports.cjs
    │       ├── 025-create-blocks.cjs
    │       └── 026-add-profile-fields-to-users.cjs
    └── moderation/
        └── profanity.ts                     # obscenity wrapper utility
```

### Pattern 1: Separate Tables for Reactions/Comments (Replicate Phase 1)
**What:** Create `post_reactions` and `post_comments` tables mirroring the `daily_reactions` and `daily_comments` schema pattern.
**When to use:** Always. This is the established pattern from Phase 1.
**Why:** Avoids polymorphic complexity, keeps queries simple, aligns with existing hooks and API patterns.

**Example (post_reactions migration):**
```javascript
// Source: Existing pattern from 014-create-daily-reactions.cjs
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('post_reactions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      user_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      post_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'posts', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      reaction_type: {
        type: Sequelize.ENUM('like', 'love', 'haha', 'wow', 'sad', 'pray'),
        allowNull: false,
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('post_reactions', ['user_id', 'post_id'], { unique: true, name: 'post_reactions_user_post_unique' });
    await queryInterface.addIndex('post_reactions', ['post_id', 'reaction_type'], { name: 'post_reactions_post_type' });
  },
  async down(queryInterface) { await queryInterface.dropTable('post_reactions'); },
};
```

### Pattern 2: Cursor-Based Pagination for Feeds
**What:** Use compound cursor (created_at, id) instead of offset-based pagination for feed queries.
**When to use:** All feed endpoints (main feed, prayer wall, category feed, profile posts).
**Why:** Offset pagination breaks when new posts are inserted (causes duplicate/skipped items). Cursor pagination is stable under concurrent writes.

**Example (API route pattern):**
```typescript
// Cursor: Base64-encoded JSON of { created_at, id }
const decodeCursor = (cursor: string) => {
  try { return JSON.parse(Buffer.from(cursor, 'base64url').toString()); }
  catch { return null; }
};

const encodeCursor = (post: { created_at: Date; id: number }) =>
  Buffer.from(JSON.stringify({ created_at: post.created_at, id: post.id })).toString('base64url');

// In query:
const where: any = { /* base filters */ };
if (cursor) {
  const { created_at, id } = decodeCursor(cursor);
  where[Op.or] = [
    { created_at: { [Op.lt]: created_at } },
    { created_at, id: { [Op.lt]: id } },
  ];
}

const posts = await Post.findAll({
  where,
  order: [['created_at', 'DESC'], ['id', 'DESC']],
  limit: limit + 1, // Fetch one extra to determine hasMore
});

const hasMore = posts.length > limit;
if (hasMore) posts.pop();
const nextCursor = hasMore ? encodeCursor(posts[posts.length - 1]) : null;
```

### Pattern 3: Infinite Scroll with useInView + Cursor
**What:** Use react-intersection-observer's useInView hook to detect when a sentinel element enters the viewport, then fetch the next page.
**When to use:** Feed page, prayer wall, category feeds, comment loading.

**Example:**
```tsx
import { useInView } from 'react-intersection-observer';

function PostFeed() {
  const { posts, hasMore, loading, fetchNextPage } = useFeed();
  const { ref, inView } = useInView({ threshold: 0 });

  useEffect(() => {
    if (inView && hasMore && !loading) {
      fetchNextPage();
    }
  }, [inView, hasMore, loading, fetchNextPage]);

  return (
    <div>
      {posts.map(post => <PostCard key={post.id} post={post} />)}
      {hasMore && <div ref={ref} className="h-10" />}
      {loading && <LoadingSpinner />}
    </div>
  );
}
```

### Pattern 4: Follow/Unfollow Toggle Pattern
**What:** Asymmetric follow (follower_id -> following_id) with optimistic UI toggle.
**When to use:** Follow button on profiles, search results, suggestions.

**Example (follows table):**
```javascript
// Migration
await queryInterface.createTable('follows', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  follower_id: {
    type: Sequelize.INTEGER, allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE', onDelete: 'CASCADE',
  },
  following_id: {
    type: Sequelize.INTEGER, allowNull: false,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE', onDelete: 'CASCADE',
  },
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
});
await queryInterface.addIndex('follows', ['follower_id', 'following_id'], { unique: true, name: 'follows_unique' });
await queryInterface.addIndex('follows', ['following_id'], { name: 'follows_following' });
```

### Pattern 5: Profanity Filtering Middleware
**What:** Wrap obscenity in a utility that validates text on submission (posts, comments, prayer requests).
**When to use:** All POST/PUT endpoints that accept user text content.

**Example:**
```typescript
// src/lib/moderation/profanity.ts
import {
  RegExpMatcher,
  TextCensor,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const censor = new TextCensor();

export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}

export function censorText(text: string): string {
  const matches = matcher.getAllMatches(text);
  return censor.applyTo(text, matches);
}
```

### Pattern 6: Block Filtering in Queries
**What:** All feed/search queries must exclude content from blocked users (in both directions).
**When to use:** Every query that returns user-generated content.

**Example:**
```typescript
// Get blocked user IDs for the current user (both directions)
const blocks = await Block.findAll({
  where: {
    [Op.or]: [
      { blocker_id: userId },
      { blocked_id: userId },
    ],
  },
  attributes: ['blocker_id', 'blocked_id'],
  raw: true,
});

const blockedUserIds = new Set<number>();
for (const b of blocks) {
  if (b.blocker_id === userId) blockedUserIds.add(b.blocked_id);
  else blockedUserIds.add(b.blocker_id);
}

// Add to WHERE clause for posts/comments:
if (blockedUserIds.size > 0) {
  where.user_id = { [Op.notIn]: [...blockedUserIds] };
}
```

### Anti-Patterns to Avoid
- **Polymorphic reactions/comments table:** Do NOT create a single reactions table with a `content_type` column. This would break the established Phase 1 pattern and make queries more complex.
- **Offset-based pagination for feeds:** Do NOT use LIMIT/OFFSET for feeds. New posts inserted between page loads cause duplicates or skipped content.
- **Client-side feed filtering:** Do NOT fetch all posts and filter client-side. Always filter in the SQL query (especially for blocks and category filters).
- **Storing images inline in the database:** Do NOT store image data in MySQL. Always use B2 presigned upload pattern.
- **Unbounded comment nesting:** Do NOT allow infinite nesting depth. Limit to 1 level of replies (parent_id on root comments, no nested replies of replies), matching the Phase 1 daily_comments pattern.

## Database Schema Design

### New Tables Required

**posts:**
```
id              INT PRIMARY KEY AUTO_INCREMENT
user_id         INT NOT NULL FK(users.id) CASCADE
body            TEXT NOT NULL
image_url       VARCHAR(500) NULL
category_id     INT NULL FK(categories.id) SET NULL
post_type       ENUM('text', 'bible_verse', 'prayer_request') DEFAULT 'text'
bible_reference VARCHAR(100) NULL  -- e.g., "John 3:16"
bible_translation VARCHAR(10) NULL -- e.g., "KJV"
bible_text      TEXT NULL           -- The verse text content
visibility      ENUM('public', 'followers') DEFAULT 'public'
edited          BOOLEAN DEFAULT false
edit_deadline   DATETIME NULL       -- Set to created_at + 15 min on create
deleted_at      DATETIME NULL       -- Soft delete (paranoid)
created_at      DATETIME NOT NULL
updated_at      DATETIME NOT NULL
```
Indexes: (user_id), (category_id), (post_type), (created_at DESC, id DESC), (user_id, created_at DESC)

**post_reactions:** (mirrors daily_reactions)
```
id              INT PRIMARY KEY AUTO_INCREMENT
user_id         INT NOT NULL FK(users.id) CASCADE
post_id         INT NOT NULL FK(posts.id) CASCADE
reaction_type   ENUM('like','love','haha','wow','sad','pray')
created_at      DATETIME
updated_at      DATETIME
```
Indexes: UNIQUE(user_id, post_id), (post_id, reaction_type)

**post_comments:** (mirrors daily_comments)
```
id              INT PRIMARY KEY AUTO_INCREMENT
user_id         INT NOT NULL FK(users.id) CASCADE
post_id         INT NOT NULL FK(posts.id) CASCADE
parent_id       INT NULL FK(post_comments.id) SET NULL
body            TEXT NOT NULL
edited          BOOLEAN DEFAULT false
edit_deadline   DATETIME NULL
created_at      DATETIME
updated_at      DATETIME
```
Indexes: (post_id, parent_id), (user_id)

**follows:**
```
id              INT PRIMARY KEY AUTO_INCREMENT
follower_id     INT NOT NULL FK(users.id) CASCADE
following_id    INT NOT NULL FK(users.id) CASCADE
created_at      DATETIME
updated_at      DATETIME
```
Indexes: UNIQUE(follower_id, following_id), (following_id)

**bookmarks:**
```
id              INT PRIMARY KEY AUTO_INCREMENT
user_id         INT NOT NULL FK(users.id) CASCADE
post_id         INT NULL FK(posts.id) CASCADE
daily_content_id INT NULL FK(daily_content.id) CASCADE
folder_id       INT NULL FK(bookmark_folders.id) SET NULL
created_at      DATETIME
updated_at      DATETIME
```
Indexes: UNIQUE(user_id, post_id), UNIQUE(user_id, daily_content_id), (folder_id)

**bookmark_folders:**
```
id              INT PRIMARY KEY AUTO_INCREMENT
user_id         INT NOT NULL FK(users.id) CASCADE
name            VARCHAR(100) NOT NULL
sort_order      INT DEFAULT 0
created_at      DATETIME
updated_at      DATETIME
```
Indexes: (user_id)

**prayer_requests:** (extends posts with prayer-specific fields)
```
id              INT PRIMARY KEY AUTO_INCREMENT
post_id         INT NOT NULL FK(posts.id) CASCADE UNIQUE
privacy         ENUM('public', 'followers', 'private') DEFAULT 'public'
status          ENUM('active', 'answered') DEFAULT 'active'
answered_at     DATETIME NULL
answered_testimony TEXT NULL
pray_count      INT DEFAULT 0     -- Denormalized for fast display
created_at      DATETIME
updated_at      DATETIME
```
Indexes: (status), (post_id)

**prayer_supports:** (who prayed for a request)
```
id              INT PRIMARY KEY AUTO_INCREMENT
user_id         INT NOT NULL FK(users.id) CASCADE
prayer_request_id INT NOT NULL FK(prayer_requests.id) CASCADE
created_at      DATETIME
updated_at      DATETIME
```
Indexes: UNIQUE(user_id, prayer_request_id), (prayer_request_id)

**reports:**
```
id              INT PRIMARY KEY AUTO_INCREMENT
reporter_id     INT NOT NULL FK(users.id) CASCADE
post_id         INT NULL FK(posts.id) SET NULL
comment_id      INT NULL  -- Could reference post_comments or daily_comments
content_type    ENUM('post', 'comment') NOT NULL
reason          ENUM('spam', 'harassment', 'hate_speech', 'inappropriate', 'misinformation', 'other') NOT NULL
details         TEXT NULL
status          ENUM('pending', 'reviewed', 'actioned', 'dismissed') DEFAULT 'pending'
created_at      DATETIME
updated_at      DATETIME
```
Indexes: (status), (reporter_id)

**blocks:**
```
id              INT PRIMARY KEY AUTO_INCREMENT
blocker_id      INT NOT NULL FK(users.id) CASCADE
blocked_id      INT NOT NULL FK(users.id) CASCADE
created_at      DATETIME
updated_at      DATETIME
```
Indexes: UNIQUE(blocker_id, blocked_id), (blocked_id)

**users table additions (migration 026):**
```
denomination    VARCHAR(100) NULL
church          VARCHAR(200) NULL
testimony       TEXT NULL
profile_privacy ENUM('public', 'followers', 'private') DEFAULT 'public'
```

### Key Design Decisions

1. **Prayer requests as post extension:** A prayer request IS a post (with post_type='prayer_request') that has an additional `prayer_requests` row. This means prayer requests appear in the regular feed AND the prayer wall filter. The prayer_requests table adds prayer-specific fields (privacy, status, answered info, pray_count).

2. **Edit deadline pattern:** Posts and comments get an `edit_deadline` column set to `created_at + 15 minutes` on creation. Edit API checks `NOW() < edit_deadline`. This is cleaner than computing the deadline from created_at in every request.

3. **Bookmark polymorphism:** Bookmarks use nullable post_id and daily_content_id columns (not a polymorphic type column). This preserves FK integrity and allows bookmarking both post and daily content types. A CHECK constraint or application logic ensures exactly one is non-null.

4. **Denormalized pray_count:** The prayer_requests table stores pray_count to avoid COUNT queries on every prayer card render. Increment/decrement on prayer_support create/delete.

5. **Soft delete for posts:** Posts use Sequelize `paranoid: true` (deleted_at column) to enable "delete" without losing data for moderation review.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Profanity detection | Custom word list + regex | `obscenity` package | Handles character variants (fuuuck, f*ck, Unicode substitution), maintains curated English dataset |
| Viewport detection | Scroll event listener + getBoundingClientRect | `react-intersection-observer` useInView | Async, performant, handles edge cases (resize, scroll container changes) |
| Image optimization | Custom sharp pipeline | Extend existing B2 presigned flow + sharp in confirm route | Already proven for avatars; just expand content types and add resize step |
| Social sharing | Custom share buttons per platform | Web Share API (navigator.share) with clipboard fallback | Native OS share sheet on mobile; copy-link fallback on desktop |
| Relative time formatting | Custom relativeTime function | Keep existing `relativeTime()` from CommentThread.tsx | Already works, tested; extract to shared utility |
| Cursor encoding | Custom format | Base64url-encoded JSON | Standard pattern, human-debuggable, compact |
| Bible verse fetching | New Bible API client | Existing `fetchVerseFromBibleApi` from `@/lib/bible-api` | Already handles API.Bible integration with caching |

**Key insight:** Phase 2's social features are largely variations of patterns already built in Phase 1. The reaction/comment system for posts should be a near-copy of the daily content system. The upload flow extends naturally. The real complexity is in feed assembly (combining followed users, category filters, block exclusions, cursor pagination) and in the prayer wall's additional state management.

## Common Pitfalls

### Pitfall 1: N+1 Queries in Feed Assembly
**What goes wrong:** Fetching a page of posts, then making separate queries for each post's reaction counts, comment counts, bookmark status, and author data.
**Why it happens:** Natural to write post fetch first, then add data per-post.
**How to avoid:** Use Sequelize includes and subqueries. For counts, use `attributes: { include: [[literal('(SELECT COUNT(*) ...)'), 'reaction_count']] }` subquery pattern. Batch-load user's reaction/bookmark status with `WHERE post_id IN (...)` after the main query.
**Warning signs:** Feed page making 30+ API calls; slow load times; visible cascading spinners.

### Pitfall 2: Block/Privacy Leaks
**What goes wrong:** User A blocks User B, but User B can still see User A's posts in category feeds, search results, or profile pages.
**Why it happens:** Block filtering added to main feed query but forgotten in other endpoints.
**How to avoid:** Create a shared `getBlockedUserIds(userId)` utility function. Every query that returns user content MUST call it and exclude those IDs. Include in API route boilerplate pattern.
**Warning signs:** Blocked user's content visible anywhere in the app.

### Pitfall 3: Race Conditions in Optimistic Updates
**What goes wrong:** User rapidly taps like/unlike; final state doesn't match server state.
**Why it happens:** Multiple concurrent toggle requests interleaving.
**How to avoid:** Follow the existing useReactions pattern: store previous state for rollback, but also add a "pending" flag that disables the button during the request. The existing pattern already handles this well -- just replicate it.
**Warning signs:** Like count flickering or being off by 1.

### Pitfall 4: Cursor Pagination Gaps with Compound Cursor
**What goes wrong:** Posts created at the exact same millisecond could be skipped or duplicated.
**Why it happens:** Using only created_at as cursor without the id tiebreaker.
**How to avoid:** Always use compound cursor (created_at, id) with the OR condition: `(created_at < cursor_time) OR (created_at = cursor_time AND id < cursor_id)`.
**Warning signs:** Occasional missing posts in feed when multiple posts have identical timestamps.

### Pitfall 5: Image Upload Without Size/Type Validation
**What goes wrong:** Users upload 50MB images or non-image files disguised as images.
**Why it happens:** Client-side validation only; server trusts content-type header.
**How to avoid:** Validate file size in presigned URL generation (reject if > 5MB). After upload confirmation, run sharp on the image to verify it's a valid image and resize/optimize. Use existing `ALLOWED_CONTENT_TYPES` pattern from presigned route.
**Warning signs:** Huge image files eating B2 storage; broken image renders.

### Pitfall 6: Prayer Count Desync
**What goes wrong:** Denormalized pray_count on prayer_requests gets out of sync with actual prayer_supports records.
**Why it happens:** Increment on create but forget to decrement on delete, or crash between operations.
**How to avoid:** Use Sequelize transactions for pray toggle (create/destroy support + increment/decrement count in same transaction). Consider periodic reconciliation job.
**Warning signs:** Prayer count shows negative numbers or doesn't match "who prayed" list.

### Pitfall 7: Missing Index on Feed Query Columns
**What goes wrong:** Feed queries scan full table as dataset grows.
**Why it happens:** Indexes not added for the compound cursor columns.
**How to avoid:** Add composite index on `(created_at DESC, id DESC)` for the posts table. Also index `(user_id, created_at DESC)` for profile post queries.
**Warning signs:** Feed load time growing linearly with post count.

### Pitfall 8: Forgetting to Update Onboarding Follow Suggestions
**What goes wrong:** The Phase 1 FollowSuggestions component uses hardcoded placeholder accounts. Phase 2 needs to connect it to real follow API.
**Why it happens:** Component works visually so it's easy to forget it's a placeholder.
**How to avoid:** Include updating FollowSuggestions.tsx to use real user data and the new follow API as an explicit task.
**Warning signs:** Onboarding still shows fake accounts after Phase 2 launch.

## Code Examples

### Feed API Route (Cursor Pagination + Filters + Block Exclusion)
```typescript
// Source: Synthesized from existing patterns in codebase
// GET /api/posts?cursor=...&limit=20&category=prayer-requests&sort=newest

export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const categorySlug = searchParams.get('category');
    const sort = searchParams.get('sort') || 'newest'; // 'newest' | 'engaged'
    const userId = context.user.id;

    // Get blocked user IDs
    const blockedIds = await getBlockedUserIds(userId);

    // Get followed user IDs for feed filtering
    const follows = await Follow.findAll({
      where: { follower_id: userId },
      attributes: ['following_id'],
      raw: true,
    });
    const followedIds = follows.map(f => f.following_id);
    followedIds.push(userId); // Include own posts

    const where: any = {
      user_id: { [Op.in]: followedIds },
      visibility: 'public', // Or add followers check
    };

    if (blockedIds.size > 0) {
      where.user_id = {
        [Op.in]: followedIds,
        [Op.notIn]: [...blockedIds],
      };
    }

    if (categorySlug && categorySlug !== 'all') {
      const category = await Category.findOne({ where: { slug: categorySlug } });
      if (category) where.category_id = category.id;
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        where[Op.or] = [
          { created_at: { [Op.lt]: decoded.created_at } },
          { created_at: decoded.created_at, id: { [Op.lt]: decoded.id } },
        ];
      }
    }

    const order = sort === 'engaged'
      ? [[literal('(reaction_count + comment_count)'), 'DESC'], ['created_at', 'DESC']]
      : [['created_at', 'DESC'], ['id', 'DESC']];

    const posts = await Post.findAll({
      where,
      include: [{ model: User, as: 'author', attributes: USER_ATTRIBUTES }],
      attributes: {
        include: [
          [literal('(SELECT COUNT(*) FROM post_reactions WHERE post_reactions.post_id = Post.id)'), 'reaction_count'],
          [literal('(SELECT COUNT(*) FROM post_comments WHERE post_comments.post_id = Post.id)'), 'comment_count'],
        ],
      },
      order,
      limit: limit + 1,
    });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    return successResponse({
      posts: posts.map(p => p.toJSON()),
      next_cursor: hasMore ? encodeCursor(posts[posts.length - 1]) : null,
      has_more: hasMore,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch feed');
  }
});
```

### Post Creation with Profanity Check and Image
```typescript
// Source: Synthesized from existing daily-comments POST pattern + upload pattern

const createPostSchema = z.object({
  body: z.string().min(1).max(5000),
  category_id: z.number().int().positive().nullable().optional(),
  post_type: z.enum(['text', 'bible_verse', 'prayer_request']).optional().default('text'),
  image_key: z.string().nullable().optional(), // B2 object key from presigned upload
  bible_reference: z.string().max(100).nullable().optional(),
  bible_translation: z.string().max(10).nullable().optional(),
  bible_text: z.string().max(5000).nullable().optional(),
  visibility: z.enum(['public', 'followers']).optional().default('public'),
  // Prayer-specific
  prayer_privacy: z.enum(['public', 'followers', 'private']).optional(),
});

export const POST = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');

    const { body: postBody, category_id, post_type, image_key, ...rest } = parsed.data;

    // Profanity check
    if (containsProfanity(postBody)) {
      return errorResponse('Your post contains inappropriate language. Please revise and try again.');
    }

    const editDeadline = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    const post = await Post.create({
      user_id: context.user.id,
      body: postBody,
      category_id: category_id ?? null,
      post_type,
      image_url: image_key ? getPublicUrl(image_key) : null,
      edit_deadline: editDeadline,
      visibility: rest.visibility,
      bible_reference: rest.bible_reference ?? null,
      bible_translation: rest.bible_translation ?? null,
      bible_text: rest.bible_text ?? null,
    });

    // If prayer request, create the prayer_requests extension row
    if (post_type === 'prayer_request') {
      await PrayerRequest.create({
        post_id: post.id,
        privacy: rest.prayer_privacy ?? 'public',
      });
    }

    return successResponse(post.toJSON(), 201);
  } catch (error) {
    return serverError(error, 'Failed to create post');
  }
});
```

### Pray Toggle with Transaction
```typescript
// POST /api/prayer-requests/[id]/pray
export const POST = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const params = await context.params;
    const prayerRequestId = parseInt(params.id, 10);
    if (isNaN(prayerRequestId)) return errorResponse('Invalid prayer request ID');

    const prayerRequest = await PrayerRequest.findByPk(prayerRequestId);
    if (!prayerRequest) return errorResponse('Prayer request not found', 404);

    const userId = context.user.id;

    const result = await sequelize.transaction(async (t) => {
      const existing = await PrayerSupport.findOne({
        where: { user_id: userId, prayer_request_id: prayerRequestId },
        transaction: t,
      });

      if (existing) {
        await existing.destroy({ transaction: t });
        await prayerRequest.decrement('pray_count', { transaction: t });
        return { action: 'removed' };
      } else {
        await PrayerSupport.create(
          { user_id: userId, prayer_request_id: prayerRequestId },
          { transaction: t }
        );
        await prayerRequest.increment('pray_count', { transaction: t });
        return { action: 'added' };
      }
    });

    return successResponse(result);
  } catch (error) {
    return serverError(error, 'Failed to toggle prayer');
  }
});
```

### Social Sharing Utility
```typescript
// No library needed -- use Web Share API with clipboard fallback
export async function sharePost(post: { id: number; body: string }) {
  const url = `${window.location.origin}/post/${post.id}`;
  const text = post.body.slice(0, 100) + (post.body.length > 100 ? '...' : '');

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Free Luma', text, url });
      return true;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return false; // User cancelled
    }
  }

  // Fallback: copy link to clipboard
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
```

### User Search with Debounce
```typescript
// Follows existing debounced username check pattern from Phase 1
export function useUserSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((q: string) => {
    setQuery(q);
    clearTimeout(timeoutRef.current);

    if (q.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.users);
        }
      } catch (err) {
        console.error('[useUserSearch] error:', err);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  return { query, results, loading, search };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Offset pagination (LIMIT/OFFSET) | Cursor-based pagination (created_at + id) | Industry standard since ~2020 | Stable pagination under concurrent writes |
| Scroll event listeners for infinite scroll | IntersectionObserver API | Widely adopted 2020+ | Non-blocking, performant viewport detection |
| Custom profanity word lists | Transformer-based matchers (obscenity) | 2022+ | Catches character variants, Unicode tricks |
| Platform-specific share buttons | Web Share API (navigator.share) | Safari 12.1, Chrome 61+ | Native OS share sheet, fewer dependencies |
| Eager-loaded image thumbnails | Presigned URL + sharp resize on confirm | B2/CDN pattern | Client uploads directly to storage, API only validates |

**Deprecated/outdated:**
- `bad-words` npm package: Last updated 2021, no TypeScript support, easily circumvented. Use `obscenity` instead.
- Scroll event-based infinite scroll: Replaced by IntersectionObserver. Still works but blocks main thread.
- Redux for local social state: The codebase uses React context + hooks, not Redux. Keep this pattern for Phase 2.

## Open Questions

1. **Edit time limit duration**
   - What we know: The requirements say "within time limit" for post/comment editing
   - What's unclear: Exact duration not specified
   - Recommendation: Use 15 minutes (common social platform standard). Store as `edit_deadline` column rather than computing from created_at.

2. **Feed composition -- followed-only vs. discovery**
   - What we know: FEED-01 says "posts from followed users"; FEED-13 says "mix of followed users' posts and daily content"; FEED-14 says "empty feed shows suggest users to follow"
   - What's unclear: Should the feed show ONLY followed users' posts, or also include some discovery content?
   - Recommendation: Start with followed-only (+ own posts). If feed is empty, show the empty state with follow suggestions. Daily content appears in its own tab (already exists), not mixed into feed.

3. **Image optimization timing**
   - What we know: FEED-11 requires optimized images via CDN (B2 + Cloudflare). Sharp is installed.
   - What's unclear: Should images be optimized at upload time (presigned confirm route) or on-demand?
   - Recommendation: Optimize at upload time in the confirm/create-post route. Run sharp to resize to max 1200px wide, convert to WebP at 85% quality. Store optimized version. Simpler than on-demand and works with CDN caching.

4. **Content moderation approach (STATE.md blocker)**
   - What we know: MOD-01 needs report system, MOD-05 needs profanity filter. STATE.md flags "Content moderation tooling approach needs decision."
   - What's unclear: Whether to use AI moderation (OpenAI Moderation API) in addition to keyword-based profanity filter.
   - Recommendation: Phase 2 implements basic profanity filter (obscenity) on submission + user report system. AI moderation can be deferred to a later phase or added as an enhancement. The report + admin review system provides the human moderation layer.

5. **Notification system dependency (PRAY-05)**
   - What we know: PRAY-05 requires "prayer request author receives notification when someone prays for them."
   - What's unclear: The notification system (push, in-app) may not be fully built yet.
   - Recommendation: Create the notification record in the database (create a notifications table if not already planned). Display in the existing notification bell dropdown. Push notifications can be a follow-up.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/lib/db/models/`, `src/app/api/`, `src/hooks/`, `src/components/` -- All patterns verified by reading actual code
- `package.json` -- Verified all installed dependencies and versions
- Existing migrations 001-015 -- Verified table schemas and FK patterns
- `STATE.md` -- Verified prior decisions and blockers

### Secondary (MEDIUM confidence)
- [GitHub: obscenity](https://github.com/jo3-l/obscenity) -- Verified API usage, transformer pattern, TypeScript support
- [GitHub: react-intersection-observer](https://github.com/thebuilder/react-intersection-observer) -- Verified useInView hook API and options
- [MDN: Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) -- Verified navigator.share() API and browser support
- [Sling Academy: Cursor Pagination in Sequelize](https://www.slingacademy.com/article/cursor-based-pagination-in-sequelizejs-practical-examples/) -- Verified compound cursor pattern with Sequelize Op

### Tertiary (LOW confidence)
- WebSearch results for "Next.js sharp image optimization" -- General patterns, not version-specific
- WebSearch results for "profanity filter comparison" -- Community opinion, not authoritative benchmarks

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All core libraries already installed and verified in codebase; only 2 new deps needed
- Architecture: HIGH -- All patterns extrapolated directly from working Phase 1 code (reactions, comments, upload, auth middleware)
- Database schema: HIGH -- Follows established migration/model patterns exactly; FK cascade strategy matches STATE.md decisions
- Pitfalls: MEDIUM -- Identified from common social platform issues and Sequelize-specific gotchas; some based on general engineering experience rather than project-specific evidence
- Code examples: HIGH -- Synthesized from actual codebase patterns (daily_reactions toggle, daily_comments CRUD, presigned upload, auth middleware)

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days -- stable domain, no fast-moving dependencies)
