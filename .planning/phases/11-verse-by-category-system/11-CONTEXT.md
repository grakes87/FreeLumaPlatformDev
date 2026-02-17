# Phase 11: Verse by Category System - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Verse by Category" alternative to the daily verse experience for bible-mode users. Users can toggle between Daily Verse (default) and Verse by Category via profile settings or a segmented control on the daily tab. When active, a random Bible verse from the selected spiritual category is displayed on each page refresh over a full-screen category background image. Includes new database tables, old DB data migration, category media upload to B2, admin category/verse management with AI-assisted verse generation, and dedicated reactions/comments separate from daily content.

</domain>

<decisions>
## Implementation Decisions

### Category Selector UX
- Overlay floating on the verse display (not a separate top row)
- Placeholder circle images (PNGs to be provided later) with category title text underneath
- Active category highlighted with colored ring + scale-up (Instagram active story style)
- Wrap-to-grid layout for all categories (no horizontal scroll)
- Collapsible: collapsed by default, auto-collapses after category selection
- Collapsed state shows active category circle + abbreviated category name
- Fade transition when switching categories
- Random background image from category's media pool on each category switch/refresh
- "All" option included — picks random verse from any category, shows source category name where date normally displays
- Category name badge always shown on the verse display (same position as date on daily content)
- Auto-collapse after category tap: selects category, fetches new verse, collapses grid

### Verse Mode Toggle (Daily Tab)
- Segmented control at top of daily tab: [Daily Post] [Verse by Category]
- Glass overlay style (bg-white/10 backdrop-blur-2xl) floating over background
- Hidden for positivity-mode users (bible-mode only)
- Switching on daily tab updates profile settings persistently (not just session)
- Subtle fade transition when switching between modes

### Profile Settings Integration
- Segmented control in settings below mode selector for bible-mode users: [Daily Verse] [Verse by Category]
- Default: Daily Verse
- When "Verse by Category" selected: category dropdown appears inline in settings
- Changing category in settings immediately syncs to daily tab
- Verse mode toggle NOT shown during onboarding (settings only, post-signup)
- Bible translation selector (KJV, NIV, etc.) works the same for verse-by-category

### Verse Display
- New random verse only on full page refresh — no in-page shuffle/refresh button
- Avoid recent repeats: track last 10 shown verse IDs in localStorage, exclude from random pool
- If user revisits a verse they previously reacted to, their reaction is shown (persisted per verse)

### Admin Management
- Categories admin-managed: add, edit, rename, reorder from admin dashboard (separate verse_categories table)
- Admin can manage individual verses within categories (add/edit/remove)
- AI verse generation: Anthropic Claude API generates verse references (admin specifies count, default 20), admin reviews/approves before saving
- Auto-deduplication: AI results filtered against existing verses in category
- Manual verse entry: admin types verse reference, system auto-fetches text from bible.api for all translations
- Media management: bulk upload initially (CategoryPhotos.zip) + admin can add/remove individual media per category later
- No verse ordering — always random display
- No published flag — all verses immediately visible

### Data Migration & Schema
- Normalized schema: verse_category_content (one row per verse) + verse_category_content_translations (one row per verse per translation) — mirrors daily_content pattern
- Separate verse_categories table with id, name, slug, description, sort_order, active, created_at, updated_at
- verse_category_media table with nullable category_id (NULL = shared across all categories, set = restricted to that category)
- Keep only KJV text from old DB (~3,564 unique verses), fetch NIV/NRSV/NAB fresh from bible.api (~10,692 API calls)
- AMP translation data dropped entirely (not in bible_translations table)
- Strip pilcrow marks (¶), smart/curly quotes, and typographic artifacts from bible.api responses before saving
- One-time import script (like import-old-data.mjs): imports old DB verses + fetches bible.api translations + uploads CategoryPhotos.zip to B2
- Batch API calls with delays between batches to avoid rate limits
- Skip and continue on bible.api failures (log failed verses, admin can add manually later)
- All 877 CategoryPhotos.zip images imported (including date-named ones) — all are category photos

### Reactions & Comments
- New separate tables: verse_category_reactions, verse_category_comments, verse_category_comment_reactions
- Same 5 reaction types as daily content: like, love, wow, sad, pray (no laugh)
- Reactions persist per verse_category_content_id — user sees their old reaction when verse reappears
- Public comments visible to all users viewing that verse
- Same threaded comment UI as daily content (2-level threads, CommentBottomSheet)
- Comment reactions supported (same pattern as daily_comment_reactions)
- Same share behavior as daily content (share card with verse text + reference + background image)
- Interactions count toward activity streak

### Claude's Discretion
- Exact grid dimensions and spacing for category circles
- Drop-down animation timing and easing
- API batch size for bible.api calls
- B2 key prefix for category media
- Exact schema column types and indexes
- Import script error logging format
- Glass overlay exact opacity and blur values

</decisions>

<specifics>
## Specific Ideas

- Category selector should feel like Instagram Stories circles (ring highlight, scale-up active state)
- Segmented controls match iOS pill-shaped style
- Where date is shown on daily content, show the category name instead (for verse-by-category)
- "All" category shows source category name in the date position so user knows which category the random verse came from
- 10 initial categories from old DB: Hope & Encouragement, Anxiety & Stress, Faith & Trust, Healing & Strength, Love & Relationships, Gratitude & Thanksgiving, Forgiveness & Mercy, Peace & Comfort, Wisdom & Guidance, Courage & Overcoming Fear
- AI verse generation uses Anthropic Claude API — admin picks category, specifies count (default 20), reviews/approves, then system fetches all translations from bible.api on save
- Database + code backup required before any code changes (safety net for revert)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-verse-by-category-system*
*Context gathered: 2026-02-16*
