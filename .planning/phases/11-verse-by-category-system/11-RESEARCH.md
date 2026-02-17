# Phase 11: Verse by Category System - Research

**Researched:** 2026-02-16
**Domain:** Database schema design, Bible API integration, admin tools, UI components (Next.js + Sequelize + Backblaze B2)
**Confidence:** HIGH

## Summary

This phase adds a "Verse by Category" mode to the existing daily content tab for bible-mode users. It requires 7 new database tables (mirroring the daily_content pattern), a data migration script, Bible API batch-fetching, category media upload to B2, admin CRUD with AI-assisted verse generation, and a new client-side display mode with category selector overlay.

The codebase already has well-established patterns for every aspect of this feature: the daily_content/daily_content_translations schema pattern for verse storage, the DailyReaction/DailyComment/DailyCommentReaction models for interactions, the bible-api module for API.Bible fetching, B2 presigned upload utilities, admin API routes with withAdmin middleware, and the DailyPostSlide component for full-screen verse display. This phase is primarily about duplicating and adapting existing patterns rather than introducing new technology.

The old database contains ~10,731 versebycategory rows across 10 categories with KJV, NIV, and AMP translations (plus smaller NAB, NKJV, NLT, NRSV subsets). The verses table has ~3,564 entries (verse references only, no text). The import strategy is: keep only KJV text from old versebycategory data, drop AMP entirely, and fetch missing translations (NIV, NKJV, NLT, CSB, NIRV, NVI, RVR) from API.Bible. With 5,000 API calls/day limit and ~3,564 unique verses needing multiple translations, the import must be batched across multiple days or use only a subset of translations initially.

**Primary recommendation:** Mirror the daily_content architecture exactly for schema design (verse_category_content + verse_category_content_translations), clone and adapt existing reaction/comment patterns, and build the import script as a standalone Node.js script following import-old-data.mjs conventions.

## Standard Stack

The established libraries/tools for this domain (all already in the project):

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sequelize | (project version) | ORM for MySQL, model definitions, migrations | Already used throughout; all DB models follow this pattern |
| @aws-sdk/client-s3 | (project version) | B2 uploads via S3-compatible API | Already configured in src/lib/storage/b2.ts |
| @aws-sdk/s3-request-presigner | (project version) | Presigned URLs for browser uploads | Already in src/lib/storage/presign.ts |
| zod | (project version) | API request validation | Used in all admin API routes |
| swiper | (project version) | Horizontal carousel for verse slides | Used in DailyPostCarousel.tsx |
| lucide-react | (project version) | Icons for UI controls | Used throughout the app |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | ^0.74.0 | AI verse reference generation for admin | Admin verse generation feature only |
| adm-zip or unzipper | latest | Extract CategoryPhotos.zip during import | One-time import script only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @anthropic-ai/sdk | Direct fetch to Anthropic API | SDK handles auth, retries, streaming; raw fetch is simpler but more brittle |
| adm-zip | Node.js built-in zlib + tar | CategoryPhotos.zip is a zip file, need proper zip extraction; unzipper streams better for large archives |

**Installation:**
```bash
npm install @anthropic-ai/sdk
# For import script only (can use as devDependency or inline):
npm install --save-dev adm-zip
```

## Architecture Patterns

### Recommended Database Schema

```
verse_categories
  id (PK, INT, auto_increment)
  name (VARCHAR(100), NOT NULL)
  slug (VARCHAR(100), UNIQUE, NOT NULL)
  description (TEXT, nullable)
  thumbnail_url (VARCHAR(500), nullable)  -- circle image for category selector
  sort_order (INT, default 0)
  active (BOOLEAN, default true)
  created_at, updated_at

verse_category_media
  id (PK, INT, auto_increment)
  category_id (INT, nullable FK -> verse_categories.id, ON DELETE SET NULL)
    -- NULL = shared across all categories
  media_url (VARCHAR(500), NOT NULL)  -- B2 public URL
  media_key (VARCHAR(255), NOT NULL)  -- B2 object key
  created_at, updated_at
  INDEX: (category_id)

verse_category_content
  id (PK, INT, auto_increment)
  category_id (INT, FK -> verse_categories.id, ON DELETE CASCADE)
  verse_reference (VARCHAR(255), NOT NULL)  -- e.g. "John 3:16"
  content_text (TEXT, NOT NULL)  -- KJV text (base/default)
  book (VARCHAR(100), NOT NULL)
  created_at, updated_at
  UNIQUE INDEX: (category_id, verse_reference)

verse_category_content_translations
  id (PK, INT, auto_increment)
  verse_category_content_id (INT, FK -> verse_category_content.id, ON DELETE CASCADE)
  translation_code (VARCHAR(10), NOT NULL)
  translated_text (TEXT, NOT NULL)
  source (ENUM('database','api'), default 'database')
  created_at, updated_at
  UNIQUE INDEX: (verse_category_content_id, translation_code)

verse_category_reactions
  id (PK, INT, auto_increment)
  user_id (INT, FK -> users.id, ON DELETE CASCADE)
  verse_category_content_id (INT, FK -> verse_category_content.id, ON DELETE CASCADE)
  reaction_type (ENUM('like','love','wow','sad','pray'), NOT NULL)
  created_at, updated_at
  UNIQUE INDEX: (user_id, verse_category_content_id)

verse_category_comments
  id (PK, INT, auto_increment)
  user_id (INT, FK -> users.id, ON DELETE CASCADE)
  verse_category_content_id (INT, FK -> verse_category_content.id, ON DELETE CASCADE)
  parent_id (INT, nullable, FK -> verse_category_comments.id)
  body (TEXT, NOT NULL)
  edited (BOOLEAN, default false)
  created_at, updated_at
  INDEX: (verse_category_content_id)
  INDEX: (parent_id)

verse_category_comment_reactions
  id (PK, INT, auto_increment)
  comment_id (INT, FK -> verse_category_comments.id, ON DELETE CASCADE)
  user_id (INT, FK -> users.id, ON DELETE CASCADE)
  created_at, updated_at
  UNIQUE INDEX: (comment_id, user_id)
```

### User Settings Extension

Add two columns to `user_settings` table:
```sql
verse_mode ENUM('daily_verse', 'verse_by_category') DEFAULT 'daily_verse'
verse_category_id INT DEFAULT NULL REFERENCES verse_categories(id)
```

Or add to `users` table directly (since `mode` and `preferred_translation` are on users, not user_settings). Decision: follow existing pattern where `mode` is on `users` table.

Add two columns to `users` table:
```sql
verse_mode ENUM('daily_verse', 'verse_by_category') DEFAULT 'daily_verse'
verse_category_id INT DEFAULT NULL REFERENCES verse_categories(id)
```

### Recommended Project Structure

```
src/lib/db/
  migrations/
    078-create-verse-categories.cjs
    079-create-verse-category-media.cjs
    080-create-verse-category-content.cjs
    081-create-verse-category-content-translations.cjs
    082-create-verse-category-reactions.cjs
    083-create-verse-category-comments.cjs
    084-create-verse-category-comment-reactions.cjs
    085-add-verse-mode-to-users.cjs
  models/
    VerseCategory.ts
    VerseCategoryMedia.ts
    VerseCategoryContent.ts
    VerseCategoryContentTranslation.ts
    VerseCategoryReaction.ts
    VerseCategoryComment.ts
    VerseCategoryCommentReaction.ts

src/app/api/
  verse-categories/
    route.ts                    # GET: list active categories with media counts
  verse-by-category/
    route.ts                    # GET: random verse for category (with exclusion list)
  verse-category-reactions/
    route.ts                    # GET/POST: reaction CRUD (mirrors daily-reactions)
  verse-category-comments/
    route.ts                    # GET/POST: comment CRUD (mirrors daily-comments)
    [id]/route.ts               # PUT/DELETE: edit/delete comment
  admin/
    verse-categories/
      route.ts                  # GET/POST/PUT: admin CRUD for categories
      [id]/
        verses/route.ts         # GET/POST/PUT/DELETE: admin verse management
        media/route.ts          # GET/POST/DELETE: admin media management
    verse-generation/
      route.ts                  # POST: AI verse reference generation

src/components/daily/
  VerseByCategorySlide.tsx      # Full-screen verse display (adapts DailyPostSlide)
  CategorySelector.tsx          # Collapsible grid overlay with circle images
  VerseModeToggle.tsx           # Segmented control [Daily Post] [Verse by Category]

src/hooks/
  useVerseByCategoryFeed.ts     # Fetches random verse, manages localStorage exclusion
  useVerseCategoryReactions.ts  # Mirrors useReactions but for verse_category_content

scripts/
  import-verse-categories.mjs  # One-time import: old DB + API.Bible + CategoryPhotos
```

### Pattern 1: Mirroring Daily Content Architecture
**What:** The verse-by-category system follows the exact same content + translations + reactions + comments pattern as daily content.
**When to use:** For all database schema, API routes, and model definitions.
**Example:**
```typescript
// VerseCategoryContent mirrors DailyContent pattern
class VerseCategoryContent extends Model<...> {
  declare id: number;
  declare category_id: number;
  declare verse_reference: string;
  declare content_text: string;  // KJV base text
  declare book: string;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

// Associations mirror DailyContent -> DailyContentTranslation pattern
VerseCategoryContent.hasMany(VerseCategoryContentTranslation, {
  foreignKey: 'verse_category_content_id',
  as: 'translations',
});
```

### Pattern 2: Random Verse Selection with Exclusion
**What:** Server-side random verse selection excluding recently-shown IDs passed from client localStorage.
**When to use:** For the GET /api/verse-by-category endpoint.
**Example:**
```typescript
// API route: GET /api/verse-by-category?category_id=3&exclude=1,5,12,34,56,78,90,23,45,67
const excludeIds = (searchParams.get('exclude') || '')
  .split(',')
  .map(Number)
  .filter(Boolean)
  .slice(0, 10);  // Cap at 10 to prevent abuse

const where: Record<string, unknown> = {};
if (categoryId !== 'all') {
  where.category_id = categoryId;
}
if (excludeIds.length > 0) {
  where.id = { [Op.notIn]: excludeIds };
}

const verse = await VerseCategoryContent.findOne({
  where,
  include: [
    { model: VerseCategoryContentTranslation, as: 'translations' },
    { model: VerseCategory, as: 'category', attributes: ['id', 'name', 'slug'] },
  ],
  order: sequelize.random(),
});

// Fallback: if exclusion empties the pool, retry without exclusion
if (!verse && excludeIds.length > 0) {
  delete where.id;
  verse = await VerseCategoryContent.findOne({
    where,
    include: [...],
    order: sequelize.random(),
  });
}
```

### Pattern 3: Client-Side Recent Verse Tracking
**What:** Track last 10 shown verse IDs in localStorage to avoid repeats.
**When to use:** In the useVerseByCategoryFeed hook.
**Example:**
```typescript
const STORAGE_KEY = 'verse_category_recent';
const MAX_RECENT = 10;

function getRecentVerseIds(): number[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function addRecentVerseId(id: number): void {
  const recent = getRecentVerseIds();
  const updated = [id, ...recent.filter(v => v !== id)].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
```

### Pattern 4: AI Verse Generation (Admin)
**What:** Admin specifies category + count, Anthropic Claude generates verse references, auto-deduplicates against existing verses, admin approves, then system fetches text from API.Bible.
**When to use:** Admin verse management panel.
**Example:**
```typescript
// Server-side: POST /api/admin/verse-generation
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const existingRefs = await VerseCategoryContent.findAll({
  where: { category_id },
  attributes: ['verse_reference'],
});
const existingSet = new Set(existingRefs.map(v => v.verse_reference));

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: `Generate ${count} Bible verse references that relate to the theme "${categoryName}".
Return ONLY a JSON array of strings, each being a verse reference like "John 3:16" or "Psalms 23:1".
Do not include verses from this list: ${JSON.stringify(Array.from(existingSet))}
Use standard book names (e.g., "Psalms" not "Psalm", "1 Corinthians" not "I Corinthians").`
  }],
});

// Parse JSON array from response, filter out any that match existing
const suggestions = JSON.parse(message.content[0].text)
  .filter((ref: string) => !existingSet.has(ref));
```

### Pattern 5: Category Background Images
**What:** Random category-specific or shared background image displayed behind verse text.
**When to use:** VerseByCategorySlide component, replacing the video background of DailyPostSlide.
**Example:**
```typescript
// API returns a random media URL for the category
// verse_category_media where category_id = X OR category_id IS NULL
const media = await VerseCategoryMedia.findOne({
  where: {
    [Op.or]: [
      { category_id: verse.category_id },
      { category_id: null },
    ],
  },
  order: sequelize.random(),
});

// Component uses <img> instead of <video> for background
<img
  src={backgroundUrl}
  alt=""
  className="absolute inset-0 h-full w-full object-cover"
/>
```

### Anti-Patterns to Avoid
- **Don't create a single monolithic migration:** Use separate migration files per table (078-084) to allow rollback granularity
- **Don't use `sequelize.fn('RAND')` directly in model code:** Use `sequelize.random()` which handles MySQL/PostgreSQL portability
- **Don't store verse text in multiple places:** KJV base text goes in verse_category_content.content_text, all translations (including KJV) go in verse_category_content_translations
- **Don't run all API.Bible calls at once:** 5,000/day limit means batching across days for ~3,564 unique verses
- **Don't use client-side random without server fallback:** Server picks random verse with `ORDER BY RAND() LIMIT 1` (efficient for tables < 10K rows), client only provides exclusion list

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bible verse text fetching | Custom scraper | `fetchVerseFromBibleApi()` in src/lib/bible-api/index.ts | Already handles parsing, HTML stripping, pilcrow removal, caching |
| B2 file uploads | Direct B2 API calls | `getUploadUrl()` from src/lib/storage/presign.ts + PutObjectCommand | Already configured with CORS, credentials, CDN URL generation |
| Reaction toggle logic | New toggle implementation | Clone DailyReaction API route pattern (POST with toggle semantics) | Exact same toggle-on/toggle-off/switch pattern |
| Comment threading | Custom tree builder | Clone DailyComment model + CommentThread/CommentBottomSheet components | Exact same 2-level threaded comment pattern |
| Activity streak tracking | New streak logic | `trackActivity()` from src/lib/streaks/tracker.ts with new activity type | Fire-and-forget pattern, just add 'verse_category_view' type |
| Verse text cleanup | Manual regex | `cleanVerseText()` and `stripHtml()` from src/lib/bible-api/index.ts | Already handles pilcrows, verse numbers, HTML tags |
| Admin route protection | Custom auth check | `withAdmin` from src/lib/auth/middleware.ts | Already checks JWT + is_admin flag |
| Verse reference parsing | Custom parser | `parseVerseReference()` from src/lib/bible-api/index.ts | Already maps all 66 books to API.Bible codes |

**Key insight:** This phase is 90% pattern-cloning from existing daily content infrastructure. The only truly new pieces are: (1) the category selector UI overlay, (2) the verse mode toggle segmented control, (3) the AI verse generation admin feature, and (4) the one-time import script.

## Common Pitfalls

### Pitfall 1: API.Bible Daily Rate Limit
**What goes wrong:** Import script tries to fetch all ~3,564 verses x multiple translations in one run, hitting the 5,000/day API limit partway through.
**Why it happens:** 3,564 KJV verses x 8 translations = ~28,512 API calls needed. With 5,000/day, this takes ~6 days.
**How to avoid:** Design the import script to be resumable: track which verses have been fetched, skip already-fetched ones on re-run. Start with KJV (already in old DB) + NIV (most common), fetch others incrementally. Consider initially importing only KJV text and using the existing on-demand `fetchVerseFromBibleApi()` to fetch other translations when users actually view them.
**Warning signs:** Import script throws 429 errors or returns empty responses.

### Pitfall 2: ORDER BY RAND() Performance
**What goes wrong:** `ORDER BY RAND()` becomes slow on large tables because MySQL generates a random value for every row.
**Why it happens:** It's O(n) in table size.
**How to avoid:** With ~3,564 verses this is fine (< 10ms). But if the table grows significantly, switch to `SELECT * FROM verse_category_content WHERE id >= (RAND() * max_id) LIMIT 1` or pre-compute a random offset. For now, `sequelize.random()` is acceptable.
**Warning signs:** Query times exceeding 100ms in production.

### Pitfall 3: Duplicate Verse References Across Categories
**What goes wrong:** The same verse (e.g., "Romans 8:28") appears in multiple categories, leading to duplicate content_text and translations.
**Why it happens:** In the old DB, versebycategory stores full text per category. The new normalized schema has one verse per category.
**How to avoid:** The UNIQUE INDEX on (category_id, verse_reference) prevents duplicate verses within a category. Cross-category duplicates are intentional (same verse can appear in multiple categories with its own reactions/comments). The verse_category_content_translations table stores translations per verse_category_content_id, so duplicates are isolated.
**Warning signs:** Large translation table if many verses repeat across categories.

### Pitfall 4: Enum Mismatch for Reaction Types
**What goes wrong:** Old daily_reactions table has 'haha' in its ENUM, but verse-by-category should not (per CONTEXT.md: "same 5 reaction types: like, love, wow, sad, pray (no laugh)").
**Why it happens:** The REACTION_TYPES constant includes 'haha', but DAILY_REACTION_TYPES filters it out.
**How to avoid:** Define the verse_category_reactions ENUM as ('like','love','wow','sad','pray') without 'haha'. Use DAILY_REACTION_TYPES constant (which already filters 'haha') for validation. Create a VERSE_CATEGORY_REACTION_TYPES constant mirroring DAILY_REACTION_TYPES.
**Warning signs:** 'haha' reaction appearing in verse-by-category UI or API accepting it.

### Pitfall 5: CategoryPhotos.zip Upload Memory Issues
**What goes wrong:** Loading all 877 images (~228 MB) into memory at once during import.
**Why it happens:** Naive approach reads entire zip into memory.
**How to avoid:** Use streaming zip extraction (e.g., `unzipper` library) to process one file at a time. Upload each image to B2 immediately after extraction, then discard from memory. Batch with delays between uploads to avoid B2 rate issues.
**Warning signs:** Node.js OOM errors during import, process exceeding 2GB memory.

### Pitfall 6: User Mode vs Verse Mode Confusion
**What goes wrong:** Conflating user.mode ('bible'|'positivity') with verse_mode ('daily_verse'|'verse_by_category'). Positivity users should never see verse-by-category.
**Why it happens:** Both are mode-like settings on the user.
**How to avoid:** verse_mode is only relevant when user.mode === 'bible'. The segmented control on the daily tab is hidden for positivity-mode users. Profile settings only show verse_mode selector when mode is 'bible'. API endpoint checks user.mode === 'bible' before returning verse-by-category data.
**Warning signs:** Positivity users seeing Bible verse category content.

### Pitfall 7: Old DB Verses Table vs VerseByCategory Table
**What goes wrong:** Confusing the two old tables. `verses` (in Main Database) has 3,564 rows with only verse_name (reference), no text. `versebycategory` (in freelumamedia.sql) has ~10,731 rows with full text, category, and translation info.
**Why it happens:** Both relate to verse-by-category but are in different databases with different structures.
**How to avoid:** Import from `versebycategory` table (freelumamedia.sql) which has the actual verse text and category mappings. The `verses` table (Main Database) is a denormalized index for the verse display feature -- its verse_comments and verse_likes can be optionally migrated but are low volume (42 comments, ~200 likes). Focus on versebycategory as the primary data source.
**Warning signs:** Import script reads from wrong table and gets no text data.

## Code Examples

### Migration File Pattern (078-create-verse-categories.cjs)
```javascript
// Source: Follows established migration pattern from 057-create-workshop-categories.cjs
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('verse_categories', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      thumbnail_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('verse_categories');
  },
};
```

### Sequelize Model Pattern (VerseCategoryContent.ts)
```typescript
// Source: Mirrors DailyContent.ts pattern
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VerseCategoryContentAttributes {
  id: number;
  category_id: number;
  verse_reference: string;
  content_text: string;
  book: string;
  created_at: Date;
  updated_at: Date;
}

export interface VerseCategoryContentCreationAttributes extends Optional<VerseCategoryContentAttributes,
  | 'id' | 'created_at' | 'updated_at'
> {}

class VerseCategoryContent extends Model<VerseCategoryContentAttributes, VerseCategoryContentCreationAttributes>
  implements VerseCategoryContentAttributes {
  declare id: number;
  declare category_id: number;
  declare verse_reference: string;
  declare content_text: string;
  declare book: string;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

VerseCategoryContent.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'verse_categories', key: 'id' },
    },
    verse_reference: { type: DataTypes.STRING(255), allowNull: false },
    content_text: { type: DataTypes.TEXT, allowNull: false },
    book: { type: DataTypes.STRING(100), allowNull: false },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'verse_category_content',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['category_id', 'verse_reference'], name: 'unique_category_verse' },
    ],
  }
);

export { VerseCategoryContent };
```

### API Route Pattern (verse-by-category/route.ts)
```typescript
// Source: Mirrors daily-posts/feed/route.ts pattern
import { NextRequest } from 'next/server';
import { Op } from 'sequelize';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  VerseCategoryContent,
  VerseCategoryContentTranslation,
  VerseCategory,
  VerseCategoryMedia,
  User,
  sequelize,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

export const GET = withAuth(async (req: NextRequest, context: AuthContext) => {
  try {
    const user = await User.findByPk(context.user.id, {
      attributes: ['id', 'mode', 'verse_mode', 'verse_category_id', 'preferred_translation'],
    });
    if (!user || user.mode !== 'bible' || user.verse_mode !== 'verse_by_category') {
      return errorResponse('Verse by category not enabled', 403);
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('category_id') || user.verse_category_id;
    const excludeIds = (searchParams.get('exclude') || '')
      .split(',').map(Number).filter(Boolean).slice(0, 10);

    const where: Record<string, unknown> = {};
    if (categoryId && categoryId !== 'all') {
      where.category_id = Number(categoryId);
    }
    if (excludeIds.length > 0) {
      where.id = { [Op.notIn]: excludeIds };
    }

    let verse = await VerseCategoryContent.findOne({
      where,
      include: [
        { model: VerseCategoryContentTranslation, as: 'translations' },
        { model: VerseCategory, as: 'category', attributes: ['id', 'name', 'slug'] },
      ],
      order: sequelize.random(),
    });

    // Fallback without exclusion
    if (!verse && excludeIds.length > 0) {
      delete where.id;
      verse = await VerseCategoryContent.findOne({
        where,
        include: [
          { model: VerseCategoryContentTranslation, as: 'translations' },
          { model: VerseCategory, as: 'category', attributes: ['id', 'name', 'slug'] },
        ],
        order: sequelize.random(),
      });
    }

    if (!verse) {
      return errorResponse('No verses found', 404);
    }

    // Random background image
    const mediaWhere: Record<string, unknown> = {
      [Op.or]: [
        { category_id: verse.category_id },
        { category_id: null },
      ],
    };
    const media = await VerseCategoryMedia.findOne({
      where: mediaWhere,
      order: sequelize.random(),
    });

    return successResponse({
      verse: { ...verse.toJSON() },
      background_url: media?.media_url || null,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch verse');
  }
});
```

### Import Script Core Logic
```javascript
// Source: Follows import-old-data.mjs pattern
// Key steps in scripts/import-verse-categories.mjs:

// 1. Parse versebycategory from freelumamedia.sql
const verseRows = parseTable(freelumamediaSql, 'versebycategory');

// 2. Extract unique categories
const categories = [...new Set(verseRows.map(r => r.Category))];
// Map enum names to display names:
const CATEGORY_NAMES = {
  HopeAndEncouragement: 'Hope & Encouragement',
  AnxietyAndStress: 'Anxiety & Stress',
  // ... etc
};

// 3. Insert verse_categories
for (const [i, cat] of categories.entries()) {
  await conn.execute(
    `INSERT INTO verse_categories (name, slug, sort_order) VALUES (?, ?, ?)`,
    [CATEGORY_NAMES[cat], slugify(cat), i + 1]
  );
}

// 4. Group verses by category + verse_reference, keep KJV as base text
const grouped = {};
for (const row of verseRows) {
  const key = `${row.Category}::${row.VerseReference}`;
  if (!grouped[key]) {
    grouped[key] = { category: row.Category, ref: row.VerseReference, book: row.Book, translations: {} };
  }
  if (row.TranslationAbv !== 'AMP') {  // Drop AMP
    grouped[key].translations[row.TranslationAbv] = row.VerseText;
  }
}

// 5. Insert verse_category_content (KJV as content_text)
// 6. Insert verse_category_content_translations
// 7. Upload CategoryPhotos.zip images to B2 with key: category-media/{filename}
// 8. Insert verse_category_media rows
```

### Segmented Control Component
```typescript
// Glass overlay segmented control pattern
function VerseModeToggle({
  mode,
  onChange,
}: {
  mode: 'daily_verse' | 'verse_by_category';
  onChange: (mode: 'daily_verse' | 'verse_by_category') => void;
}) {
  return (
    <div className="relative flex rounded-full bg-white/10 p-1 backdrop-blur-2xl">
      <button
        onClick={() => onChange('daily_verse')}
        className={cn(
          'relative z-10 rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
          mode === 'daily_verse' ? 'text-white' : 'text-white/60'
        )}
      >
        Daily Post
      </button>
      <button
        onClick={() => onChange('verse_by_category')}
        className={cn(
          'relative z-10 rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
          mode === 'verse_by_category' ? 'text-white' : 'text-white/60'
        )}
      >
        Verse by Category
      </button>
      {/* Animated pill indicator */}
      <div
        className={cn(
          'absolute top-1 bottom-1 rounded-full bg-white/20 transition-all duration-200',
          mode === 'daily_verse' ? 'left-1 w-[calc(50%-4px)]' : 'left-[50%] w-[calc(50%-4px)]'
        )}
      />
    </div>
  );
}
```

### Category Selector Component Pattern
```typescript
// Instagram Stories-style circle grid
function CategorySelector({
  categories,
  activeId,
  onSelect,
  collapsed,
  onToggle,
}: {
  categories: Array<{ id: number | 'all'; name: string; thumbnail_url: string | null }>;
  activeId: number | 'all';
  onSelect: (id: number | 'all') => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const activeCategory = categories.find(c => c.id === activeId);

  return (
    <div className="absolute top-16 left-0 right-0 z-20 px-4">
      {collapsed ? (
        // Collapsed: show active category circle + name
        <button onClick={onToggle} className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full ring-2 ring-white/80 overflow-hidden">
            <img src={activeCategory?.thumbnail_url || '/placeholder.png'} className="h-full w-full object-cover" />
          </div>
          <span className="text-xs font-medium text-white/80 truncate max-w-[80px]">
            {activeCategory?.name}
          </span>
          <ChevronDown className="h-3 w-3 text-white/60" />
        </button>
      ) : (
        // Expanded: wrap-to-grid of all categories
        <div className="rounded-2xl bg-black/40 p-4 backdrop-blur-xl">
          <div className="grid grid-cols-5 gap-3">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className="flex flex-col items-center gap-1"
              >
                <div className={cn(
                  'h-14 w-14 rounded-full overflow-hidden transition-all duration-200',
                  cat.id === activeId
                    ? 'ring-2 ring-blue-400 scale-110'
                    : 'ring-1 ring-white/30 opacity-70'
                )}>
                  <img src={cat.thumbnail_url || '/placeholder.png'} className="h-full w-full object-cover" />
                </div>
                <span className="text-[10px] text-white/80 text-center line-clamp-1">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Old `versebycategory` table with denormalized translations per row | Normalized content + translations tables | This phase | Consistent with daily_content pattern, enables translation switching |
| Old `verses` table with only reference (no text) | verse_category_content with full text + translations | This phase | No need for separate verse index table |
| AMP translation included | AMP dropped, translations aligned with bible_translations table | This phase | AMP not available via API.Bible, not in project's translation list |
| Old `tile_category` on users table (string reference) | `verse_category_id` foreign key on users table | This phase | Proper FK constraint, integer reference |
| Old `top_slide_preference` = 'verse_by_category' string | `verse_mode` ENUM on users table | This phase | Explicit enum, cleaner than overloaded string |

**Deprecated/outdated:**
- `verses` table (Main Database): Only has verse references, no text. Superseded by versebycategory data.
- `AMP` translation: Not in the project's bible_translations table, not available on API.Bible for reliable fetching. Drop entirely.
- `verse_likes` / `verse_comments` tables: Low volume (42 comments, ~200 likes). Old format (single is_liked boolean instead of reaction types). Not worth migrating -- fresh start with new reaction/comment tables.

## Open Questions

Things that couldn't be fully resolved:

1. **API.Bible Rate Limit Strategy**
   - What we know: 5,000 queries/day, ~3,564 unique verses to fetch across multiple translations
   - What's unclear: Whether the import should fetch all translations upfront (taking ~6 days at 5K/day for 8 translations) or import only KJV text and lazy-fetch others on demand (using existing fetchVerseFromBibleApi pattern)
   - Recommendation: Import KJV text from old DB (already available), import NIV from old DB (already available), and lazy-fetch other translations on first user access using the existing `fetchVerseFromBibleApi()` function adapted for verse_category_content. This avoids the rate limit issue entirely and spreads API calls over time.

2. **Smart/Curly Quote Stripping Scope**
   - What we know: CONTEXT.md says "Strip pilcrow marks, smart/curly quotes, and typographic artifacts from bible.api responses"
   - What's unclear: Whether old DB versebycategory text also has these artifacts (likely from prior API.Bible fetches)
   - Recommendation: Apply the same `cleanVerseText()` function to both old DB imports and fresh API.Bible fetches. Add curly quote normalization: `text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')`

3. **Migration Number Gap**
   - What we know: Latest migration is 077. Phase 11 migrations should start at 078.
   - What's unclear: Whether any other phases (9, 10) will add migrations before this phase runs
   - Recommendation: Use 078-085 range. If conflicts arise, renumber on merge.

4. **Category Thumbnail Images**
   - What we know: CONTEXT.md says "Placeholder circle images (PNGs to be provided later)"
   - What's unclear: Whether CategoryPhotos.zip images should be used as category thumbnails or only as verse background images
   - Recommendation: CategoryPhotos.zip images are all full background photos (nature/scenery). Use them as verse background images in verse_category_media. For category thumbnails (circles), use placeholder images initially (colored gradient circles with category initial) until PNGs are provided.

## Old Database Data Inventory

### versebycategory (freelumamedia.sql)
- **Total rows:** ~10,731
- **Translations:** KJV (4,375), NIV (3,901), AMP (3,398 -- to be dropped), NAB (429), NLT (309), NKJV (308), NRSV (213)
- **Categories:** 10 (HopeAndEncouragement: 846, AnxietyAndStress: 1,496, FaithAndTrust: 897, HealingAndStrength: 1,499, LoveAndRelationships: 1,060, GratitudeAndThanksgiving: 620, ForgivenessAndMercy: 886, PeaceAndComfort: 991, WisdomAndGuidance: 1,063, CourageAndOvercomingFear: 1,373)
- **Unique verses per category (estimated):** Divide by ~3 translations per verse = ~350-500 per category
- **Data includes:** TranslationAbv, Category (enum), Book, VerseReference, VerseText, ChapterText (mostly empty), AudioUrl/SrtUrl (mostly NULL)

### verses (Main Database)
- **Total rows:** ~3,564
- **Contains:** verse_name (reference only, e.g. "John 3:16"), likes_count, comments_count
- **No text data** -- just an index of verse references

### verse_comments (Main Database)
- **Total rows:** 42
- **Structure:** verse_id FK, user_id FK, parent_id (0 = root), text_content

### verse_likes (Main Database)
- **Total rows:** ~200 (6 INSERT batches)
- **Structure:** verse_name (string!), user_id, is_liked boolean

### verse_user_comments (Main Database)
- **Total rows:** 1
- **Structure:** comment_id FK, user_id, is_liked boolean (comment likes)

### homescreen_tile_categories (Main Database)
- **Total rows:** 10 (matches versebycategory enum values)
- **Category slugs:** hopeandencouragement, anxietyandstress, faithandtrust, healingandstrength, loveandrelationships, gratitudeandthanksgiving, forgivenessandmercy, peaceandcomfort, wisdomandguidance, courageandovercomingfear

### CategoryPhotos.zip
- **Total files:** 877 images
- **Total size:** ~228 MB
- **Formats:** JPEG and JPG
- **Naming:** Mix of numbered (0797_Beautiful Natural Medium.jpeg) and date-named (2025-12-29.jpg)
- **All category photos** -- no category-to-image mapping in old DB; all imported as shared (category_id = NULL)

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- All model patterns, API routes, component structures, and migration conventions verified by reading actual source files
- **Old Database SQL dumps** -- Exact table schemas and data counts from `Old Database/Main Free Luma Database.sql` and `Old Database/freelumamedia.sql`
- **CategoryPhotos.zip** -- File count (877) and size (228 MB) verified via `unzip -l`

### Secondary (MEDIUM confidence)
- [API.Bible Rate Limiting](https://docs.api.bible/getting-started/rate-limiting/) -- 5,000 queries/day, 500 verses per request
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- v0.74.0 latest

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in project, verified by reading package.json and source files
- Architecture: HIGH -- Direct pattern cloning from existing daily_content system, verified all source files
- Database schema: HIGH -- Designed from analysis of existing models (DailyContent, DailyReaction, DailyComment) and old DB structure
- Migration data: HIGH -- Exact row counts and column structures verified from SQL dumps
- Pitfalls: HIGH -- Derived from actual codebase constraints (API rate limits, ENUM values, table sizes)
- AI integration: MEDIUM -- @anthropic-ai/sdk API verified via npm, but prompt engineering for verse generation not tested

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, no fast-moving dependencies)
