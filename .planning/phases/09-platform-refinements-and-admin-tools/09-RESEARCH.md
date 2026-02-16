# Phase 9: Platform Refinements & Admin Tools - Research

**Researched:** 2026-02-16
**Domain:** Admin tools, font management, reaction system, view tracking, activation codes
**Confidence:** HIGH

## Summary

Phase 9 covers six distinct feature areas: (1) per-field font family system using Google Fonts, (2) activation code management admin page, (3) admin proxy workshop creation, (4) removal of haha reactions from prayer wall and daily content, (5) repost view count badges in profile grid, and (6) video thumbnail regeneration button. Each area has been investigated against the existing codebase.

The codebase already has strong foundations for most of these features. The PlatformSetting KV store supports storing font configuration as JSON. The activation code API and model already exist with batch generation, just need a UI and schema changes (no expiry, source indicator). The workshop creation form is a shared component that can be extended with a host picker. Reaction removal is a targeted change to constants and a cleanup migration. View counts for reposts are already computed and returned by the profile API -- they just need to be displayed. Video thumbnail regeneration already works via the `/api/videos/[id]/process` endpoint -- it just needs a button visible for all videos.

**Primary recommendation:** Implement as independent feature streams that can be planned and executed in parallel. The font system is the most complex feature and should be planned first.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PlatformSetting model | N/A | KV store for font config | Already has get()/set() helpers |
| Google Fonts CSS2 API | v2 | Runtime font loading | No library needed, direct link tags |
| Sequelize migrations | .cjs | Schema changes | Established pattern |
| Zod | v4 | Request validation | Already used everywhere |
| lucide-react | current | Icons (Eye, RefreshCw, Search) | Already used project-wide |
| react-hook-form | current | Workshop form | Already in CreateWorkshopForm |

### Supporting (New)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Google Fonts Developer API | v1 | Fetch font metadata (categories, variants) | Build curated font list for admin |
| None needed | - | - | All features use existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Google Fonts CSS link tags | next/font/google | next/font is compile-time, cannot do per-field dynamic loading at runtime |
| Google Fonts Developer API at runtime | Hardcoded JSON list of 100 fonts | Simpler, no API key, works offline; recommended approach |
| Separate font settings table | PlatformSetting JSON blob | JSON blob in single KV row is simpler for the small dataset |

**Installation:**
```bash
# No new packages needed -- all features use existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (admin)/admin/
│   │   ├── settings/page.tsx          # Existing -- font section added here
│   │   └── activation-codes/page.tsx  # NEW admin page
│   └── api/
│       ├── admin/
│       │   ├── activation-codes/route.ts  # Existing -- needs enhancement
│       │   └── workshops/route.ts         # Existing -- add create_on_behalf action
│       └── platform-settings/route.ts     # Existing -- allow font_config key
├── components/
│   ├── admin/
│   │   ├── AdminSettings.tsx    # Existing -- add FontFamilySection
│   │   ├── FontFamilySection.tsx  # NEW collapsible font config
│   │   ├── ActivationCodeManager.tsx  # NEW admin page content
│   │   └── AdminNav.tsx         # Existing -- add Activation Codes link
│   └── workshop/
│       └── CreateWorkshopForm.tsx  # Existing -- add optional hostId prop
├── hooks/
│   └── usePlatformSettings.ts   # Existing -- add fontConfig getter
└── lib/
    └── fonts/
        └── google-fonts.ts      # NEW: curated font list + loading helpers
```

### Pattern 1: Font Configuration via PlatformSetting JSON
**What:** Store font assignments as a single JSON blob in platform_settings with key `font_config`
**When to use:** Admin configures fonts, main app reads and applies
**Example:**
```typescript
// Stored in platform_settings as key='font_config', value=JSON string
// Schema:
interface FontConfig {
  [fieldCategory: string]: string; // e.g., "nav_labels": "Roboto", "headings": "Playfair Display"
}

// Admin saves:
await PlatformSetting.set('font_config', JSON.stringify({
  nav_labels: 'Roboto',
  feed_card_body: 'Open Sans',
  daily_post_verse: 'Playfair Display',
  headings: 'Montserrat',
  // ... other fields
}));

// Main app reads (via usePlatformSettings):
const fontConfig = JSON.parse(getSetting('font_config') || '{}');
```

### Pattern 2: Dynamic Google Fonts Loading via Link Tag
**What:** Inject `<link>` tag in `<head>` to load only the fonts currently selected
**When to use:** Main app loads fonts on initial render based on font_config
**Example:**
```typescript
// Build Google Fonts URL from unique font families in config
function buildGoogleFontsUrl(fontConfig: Record<string, string>): string {
  const uniqueFonts = [...new Set(Object.values(fontConfig))];
  if (uniqueFonts.length === 0) return '';
  const families = uniqueFonts
    .map(f => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

// In layout or FontLoader component:
// 1. <link rel="preconnect" href="https://fonts.googleapis.com" />
// 2. <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
// 3. <link rel="stylesheet" href={buildGoogleFontsUrl(fontConfig)} />
```

### Pattern 3: Admin Font Preview via Lazy Loading
**What:** Admin page loads all 100 Google Fonts for preview, not the main app
**When to use:** Admin font configuration section
**Example:**
```typescript
// Admin page only: load ALL curated fonts for preview
const ALL_FONTS_URL = 'https://fonts.googleapis.com/css2?' +
  CURATED_FONTS.map(f => `family=${encodeURIComponent(f.family)}:wght@400;700`).join('&') +
  '&display=swap';

// Inject on admin settings page mount only
useEffect(() => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ALL_FONTS_URL;
  document.head.appendChild(link);
  return () => { document.head.removeChild(link); };
}, []);
```

### Pattern 4: Curated Font List as Static Data
**What:** Hardcoded array of 100 Google Fonts with metadata (name, category)
**When to use:** Font picker dropdown, category filters
**Example:**
```typescript
// src/lib/fonts/google-fonts.ts
export interface GoogleFont {
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
}

export const CURATED_FONTS: GoogleFont[] = [
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Pacifico', category: 'handwriting' },
  { family: 'Fira Code', category: 'monospace' },
  // ... 95 more
];
```

### Pattern 5: Activation Code Admin with Source Indicator
**What:** Extend ActivationCode model with `source` column for import tracking
**When to use:** Distinguishing imported vs generated codes
**Example:**
```typescript
// Migration adds 'source' column: 'generated' | 'imported'
// Default: 'generated'

// API enhancement for activation code listing:
// Include user association for used_by display
const codes = await ActivationCode.findAndCountAll({
  where,
  include: [{
    model: User,
    as: 'usedByUser',
    attributes: ['id', 'username', 'display_name'],
  }],
  order: [['created_at', 'DESC']],
  limit: 50,
  offset,
});
```

### Pattern 6: Admin Proxy Workshop Creation
**What:** Admin creates workshop with host_id pointing to another user
**When to use:** Admin workshop management page
**Example:**
```typescript
// New admin endpoint action in PUT /api/admin/workshops:
// action: 'create_on_behalf'
// Accepts: { title, description, ..., host_id: number }
// Steps:
// 1. Validate host user exists
// 2. Auto-set can_host=true if not already
// 3. Create workshop with host_id = selected user
// 4. Store created_by_admin_id on workshop (new nullable column)
// 5. Send notification to host: "Admin created a workshop for you: {title}"
```

### Anti-Patterns to Avoid
- **Loading all 100 fonts on main app:** Only load the selected fonts (typically 2-5 unique families)
- **Using next/font/google for dynamic fonts:** next/font is compile-time; runtime per-field selection requires CSS link tags
- **Storing font config per-row in platform_settings:** Use a single JSON blob instead of N rows
- **MySQL ENUM modification for haha removal:** Do NOT alter the ENUM to remove 'haha' -- just delete existing rows and remove from UI constants. The ENUM stays for backwards compatibility.
- **Separate view_count column on posts:** Post view counts already work via PostImpression count -- no new column needed

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font loading | Custom @font-face CSS generation | Google Fonts CSS2 API link tags | Google handles subsetting, caching, format negotiation |
| Font category metadata | Scraping Google Fonts | Hardcoded curated list (100 fonts) | Avoids API key dependency, works offline, known good set |
| Activation code generation | Custom random strings | Existing `generateCode()` in admin route | Already excludes O/0/I/l, 12 chars, crypto.randomBytes |
| CSV export | npm library | Browser-native Blob + URL.createObjectURL | Simple flat CSV with 2-3 columns; no library needed |
| Pagination | Custom implementation | Existing offset-based pattern from admin codes route | Already has page/limit/total_pages |
| User search for host picker | New endpoint | Existing GET /api/admin/users?search= | Already supports username/display_name/email LIKE search |

**Key insight:** Nearly every feature in this phase extends existing infrastructure rather than creating new systems. The activation code API exists, workshop creation exists, reaction constants exist, view counts exist, thumbnail regeneration exists. This phase is primarily UI work and targeted schema adjustments.

## Common Pitfalls

### Pitfall 1: Font Loading Performance (FOUT/FOIT)
**What goes wrong:** Loading Google Fonts causes visible flash of unstyled text (FOUT) or invisible text (FOIT)
**Why it happens:** Browser renders text before web font downloads
**How to avoid:** Always use `display=swap` in Google Fonts URL. Add `<link rel="preconnect">` for `fonts.googleapis.com` and `fonts.gstatic.com`. Load font CSS in `<head>` not dynamically after render.
**Warning signs:** Text briefly appears in system font then jumps to web font on page load

### Pitfall 2: Font Config Cache Staleness
**What goes wrong:** Admin changes fonts but users see old fonts until hard refresh
**Why it happens:** usePlatformSettings fetches on mount; no invalidation mechanism
**How to avoid:** Accept this trade-off (settings refresh on next page load). The font CSS URL itself will be cached by the browser -- changing the URL triggers a new fetch. Consider adding a `font_config_version` counter to bust the CSS cache.
**Warning signs:** Admin publishes new fonts, checks app in another tab, sees old fonts

### Pitfall 3: MySQL ENUM Removal for Haha Reactions
**What goes wrong:** Attempting to ALTER ENUM to remove 'haha' causes errors if any rows still reference it
**Why it happens:** MySQL does not allow removing an ENUM value that is still referenced
**How to avoid:** Do NOT modify the ENUM. Just delete existing haha rows via migration and remove haha from the UI constants. The ENUM stays with 'haha' as a valid but unused value. This is safe and backwards-compatible.
**Warning signs:** Migration fails with "Data truncated for column 'reaction_type'"

### Pitfall 4: Repost View Count Already Computed
**What goes wrong:** Developer creates new API endpoints or columns for repost view counts
**Why it happens:** Not realizing the profile API already returns view_count on originalPost and quotePost in the reposts tab
**How to avoid:** The data is ALREADY returned. The only change needed is in `ProfileGridItem.tsx` to show the eye+count badge for the `reposts` tab. Check `src/app/api/users/[id]/profile/route.ts` lines 472 and 479.
**Warning signs:** Unnecessary API changes or new database columns

### Pitfall 5: Activation Code Expiry Column
**What goes wrong:** The existing ActivationCode model has `expires_at` as NOT NULL, but the decision says codes never expire
**Why it happens:** Original schema was designed with expiry in mind
**How to avoid:** The migration should either: (a) make expires_at nullable and set future codes to null, or (b) set expires_at to a very far future date (e.g., 9999-12-31). Option (b) is simpler as it avoids changing the NOT NULL constraint and existing code that uses expires_at. The admin POST endpoint already sets `expires_in_days` (default 365) -- change default to a very large number or remove expiry logic from the generation endpoint.
**Warning signs:** Old codes appearing as "expired" in the admin UI

### Pitfall 6: Old Database Has No Activation Codes
**What goes wrong:** Planning includes importing activation codes from old database that don't exist
**Why it happens:** The CONTEXT mentions "Import existing codes from old database" but the old database SQL dump has no activation codes table
**How to avoid:** The old database (29 tables) does not contain any activation_codes, access_codes, invite_codes, or similar tables. The import requirement may refer to codes that exist in the current new database (seeded or admin-generated). Clarify with user during planning, but likely this means importing codes from the current seed/admin-generated set after a database reset, not from the old SQL dump.
**Warning signs:** Import script looking for a table that doesn't exist

### Pitfall 7: Workshop created_by_admin Column
**What goes wrong:** No way to distinguish admin-created workshops from user-created ones
**Why it happens:** Workshop model has no column to track this
**How to avoid:** Add a nullable `created_by_admin_id` column (FK to users) via migration. When admin creates on behalf, set this field. The admin workshops page can display "Created by admin" badge when this field is non-null. Public view ignores this field entirely.
**Warning signs:** Admin sees no indication of which workshops they created on behalf of users

## Code Examples

### Reaction Type Filtering for Prayer/Daily (Removing Haha)
```typescript
// src/lib/utils/constants.ts -- add filtered lists
export const PRAYER_REACTION_TYPES = REACTION_TYPES.filter(t => t !== 'haha');
export const DAILY_REACTION_TYPES = REACTION_TYPES.filter(t => t !== 'haha');
// POST_REACTION_TYPES stays as REACTION_TYPES (all 6)

// In ReactionPicker.tsx and QuickReactionPicker.tsx:
// Accept a `types` prop to control which reactions to show
// Default to REACTION_TYPES for backwards compatibility
interface ReactionPickerProps {
  types?: readonly ReactionType[];
  // ... existing props
}
// Daily and prayer components pass DAILY_REACTION_TYPES / PRAYER_REACTION_TYPES
```

### Migration to Delete Existing Haha Reactions
```javascript
// Migration 071-remove-haha-from-prayer-daily.cjs
module.exports = {
  async up(queryInterface) {
    // Delete haha reactions from daily_reactions
    await queryInterface.sequelize.query(
      `DELETE FROM daily_reactions WHERE reaction_type = 'haha'`
    );
    // Delete haha reactions from post_reactions WHERE post is prayer_request type
    await queryInterface.sequelize.query(
      `DELETE pr FROM post_reactions pr
       INNER JOIN posts p ON pr.post_id = p.id
       WHERE pr.reaction_type = 'haha' AND p.post_type = 'prayer_request'`
    );
  },
  async down() {
    // Cannot restore deleted reactions
  },
};
```

### Repost View Count Badge in ProfileGridItem
```typescript
// In ProfileGridItem.tsx -- extend the view count badge condition:
// Currently: {tab === 'posts' && isVideo && (...)}
// Change to:  {(tab === 'posts' || tab === 'reposts') && viewCount > 0 && (...)}
{(tab === 'posts' || tab === 'reposts') && viewCount > 0 && (
  <div className="absolute bottom-1 right-1.5 flex items-center gap-0.5 text-white">
    <Eye className="h-3 w-3" />
    <span className="text-[11px] font-semibold drop-shadow">
      {formatCount(viewCount)}
    </span>
  </div>
)}
```

### View Count Increment for Repost Views
```typescript
// In the post detail page or feed view handlers:
// When viewing a repost, increment the ORIGINAL post's impression count
// The PostImpression model tracks unique user views
// Fire-and-forget pattern (established for Video.increment):
PostImpression.findOrCreate({
  where: { post_id: originalPostId, user_id: currentUserId },
  defaults: { post_id: originalPostId, user_id: currentUserId },
}).catch(() => {}); // Fire-and-forget
```

### Activation Code Model Enhancement
```typescript
// Migration to add 'source' column and 'used_at' column, make expires_at effectively infinite
// Migration 071 or 072 (depending on reaction migration numbering):
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('activation_codes', 'source', {
      type: Sequelize.ENUM('generated', 'imported'),
      defaultValue: 'generated',
      allowNull: false,
    });
    await queryInterface.addColumn('activation_codes', 'used_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('activation_codes', 'source');
    await queryInterface.removeColumn('activation_codes', 'used_at');
  },
};
```

### Admin Workshop Creation on Behalf
```typescript
// In PUT /api/admin/workshops route, add new action:
if (action === 'create_on_behalf') {
  const { host_id, title, description, category_id, scheduled_at, duration_minutes, is_private } = body;

  // Validate host exists
  const hostUser = await User.findByPk(host_id, { attributes: ['id', 'can_host', 'status'] });
  if (!hostUser) return errorResponse('Host user not found', 404);

  // Auto-enable can_host
  if (!hostUser.can_host) {
    await hostUser.update({ can_host: true });
  }

  // Create workshop
  const workshop = await Workshop.create({
    host_id,
    title,
    description,
    category_id,
    scheduled_at,
    duration_minutes,
    is_private,
    created_by_admin_id: context.user.id,
  });

  // Notify host
  await createNotification({
    recipient_id: host_id,
    actor_id: context.user.id,
    type: 'workshop_updated', // reuse existing type
    entity_type: 'workshop',
    entity_id: workshop.id,
    message: `Admin created a workshop for you: ${title}`,
  });

  return successResponse({ workshop });
}
```

### Font Loader Component for Main App
```typescript
// src/components/layout/FontLoader.tsx
'use client';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

export function FontLoader() {
  const { getSetting } = usePlatformSettings();
  const fontConfig = JSON.parse(getSetting('font_config') || '{}');
  const uniqueFonts = [...new Set(Object.values(fontConfig) as string[])];

  if (uniqueFonts.length === 0) return null;

  const families = uniqueFonts
    .map(f => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700`)
    .join('&');
  const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={href} />
    </>
  );
}
```

### CSS Variable Application per Text Field
```typescript
// Apply fonts to text fields via CSS custom properties or inline styles
// In the component tree, a FontProvider sets CSS variables on a wrapper div:
const fontConfig = JSON.parse(getSetting('font_config') || '{}');

// CSS variables approach:
const fontVars: Record<string, string> = {};
for (const [field, fontFamily] of Object.entries(fontConfig)) {
  fontVars[`--font-${field.replace(/_/g, '-')}`] = `'${fontFamily}', sans-serif`;
}

// Components reference via Tailwind arbitrary values or inline styles:
// style={{ fontFamily: `var(--font-headings, inherit)` }}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next/font/google static | CSS2 API link for dynamic | Always (next/font is build-time) | Runtime font selection requires CSS link approach |
| ENUM modification | Leave ENUM, delete rows | N/A (MySQL best practice) | Safer migrations, no data truncation risk |
| Separate view_count column | PostImpression count | Phase 2 design | No schema changes needed for repost views |
| Manual code generation UI | Batch generation API | Phase 1 design | Already exists, just needs admin UI |

**Deprecated/outdated:**
- Google Fonts CSS1 API (v1): Use CSS2 API (`/css2?family=`) not old format (`/css?family=`)

## Open Questions

1. **Old database activation codes**
   - What we know: The old SQL dump (29 tables) has NO activation codes table
   - What's unclear: The CONTEXT says "import existing codes from old database" -- this may be a misunderstanding, or codes may have been managed externally
   - Recommendation: During planning, clarify with user. The import feature should still exist as a general "import codes from CSV" mechanism, and the source indicator should still be implemented. Mark existing seeded codes as source='generated'.

2. **Font field categories -- codebase audit needed**
   - What we know: CONTEXT says Claude will audit the codebase to build text field category list
   - What's unclear: Exact list of distinct text fields that should be independently configurable
   - Recommendation: The planner should perform a codebase audit as part of the first plan, examining components to identify text field categories. Proposed initial groupings based on code review:
     - **Navigation**: Bottom nav labels, top bar title
     - **Feed Cards**: Post body text, username, timestamp
     - **Daily Post**: Verse/quote text, chapter reference, subtitle
     - **Profile**: Display name, bio, stats labels
     - **Headings**: Page titles (h1/h2), section headers
     - **Prayer Wall**: Prayer request body, supporter counts
     - **Comments**: Comment text
     - **General**: Body text default, button labels

3. **Workshop created_by_admin_id column**
   - What we know: Need a way to mark admin-created workshops
   - What's unclear: Whether to add a new column or use a different tracking mechanism
   - Recommendation: Add nullable `created_by_admin_id` INTEGER FK to users table on workshops. Simple, explicit, queryable.

4. **Repost view increment on view**
   - What we know: Profile API already returns view_count for reposts, PostImpression model exists
   - What's unclear: Where exactly repost views should trigger the increment (post detail page vs feed scroll)
   - Recommendation: When a user navigates to a repost's detail (which shows the original post), create a PostImpression for the original post. The existing post detail page likely already does this for direct views -- just ensure reposts follow the same path.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: PlatformSetting model (`src/lib/db/models/PlatformSetting.ts`) -- KV store with get()/set()
- Codebase inspection: ActivationCode model (`src/lib/db/models/ActivationCode.ts`) -- existing schema with code, used, used_by, mode_hint, expires_at, created_by
- Codebase inspection: Admin activation codes API (`src/app/api/admin/activation-codes/route.ts`) -- batch generation + listing already exist
- Codebase inspection: ProfileGridItem (`src/components/profile/ProfileGridItem.tsx`) -- view count badge pattern for posts tab
- Codebase inspection: Profile API (`src/app/api/users/[id]/profile/route.ts` lines 430-485) -- repost view_count already computed from PostImpression
- Codebase inspection: Video process API (`src/app/api/videos/[id]/process/route.ts`) -- thumbnail regeneration endpoint exists
- Codebase inspection: DailyReaction model (`src/lib/db/models/DailyReaction.ts`) -- ENUM includes 'haha'
- Codebase inspection: constants.ts (`src/lib/utils/constants.ts`) -- REACTION_TYPES array with 'haha'
- Codebase inspection: ReactionPicker/QuickReactionPicker -- both use REACTION_TYPES directly
- Codebase inspection: CreateWorkshopForm (`src/components/workshop/CreateWorkshopForm.tsx`) -- shared form with mode prop
- Codebase inspection: AdminWorkshopsPage (`src/app/(admin)/admin/workshops/page.tsx`) -- existing workshop management
- Codebase inspection: AdminSettings (`src/components/admin/AdminSettings.tsx`) -- collapsible groups pattern
- Codebase inspection: usePlatformSettings hook -- reads all platform settings on mount
- Codebase inspection: Workshop model (`src/lib/db/models/Workshop.ts`) -- no created_by_admin_id column yet
- Codebase inspection: AdminNav (`src/components/admin/AdminNav.tsx`) -- 7 nav items, no activation codes entry
- Codebase inspection: Admin users API (`src/app/api/admin/users/route.ts`) -- search by username/display_name/email
- Codebase inspection: globals.css -- body font is `Arial, Helvetica, sans-serif`, no Google Fonts loaded
- Codebase inspection: Root layout (`src/app/layout.tsx`) -- no font loading, no preconnect
- Codebase inspection: Old database SQL dump -- 29 tables, NO activation codes table
- Codebase inspection: Video admin page (`src/app/(admin)/admin/videos/page.tsx`) -- retry thumbnail button exists but only shows when !thumbnail_url

### Secondary (MEDIUM confidence)
- [Google Fonts CSS2 API docs](https://developers.google.com/fonts/docs/css2) -- URL format for multiple fonts with weight ranges and display=swap
- [Google Fonts Developer API](https://developers.google.com/fonts/docs/developer_api) -- font metadata including categories (serif, sans-serif, display, handwriting, monospace)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all existing codebase patterns, no new libraries needed
- Architecture: HIGH -- extending established patterns (PlatformSetting KV, withAdmin middleware, existing components)
- Font system: MEDIUM -- Google Fonts dynamic loading is well-documented but per-field application is custom design work requiring codebase audit
- Pitfalls: HIGH -- all pitfalls verified against actual codebase state
- Activation code import: MEDIUM -- old DB confirmed to have no activation codes; "import" requirement needs user clarification

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- stable domain, no fast-moving dependencies)
