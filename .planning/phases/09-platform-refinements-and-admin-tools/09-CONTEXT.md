# Phase 9: Platform Refinements & Admin Tools - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Targeted UX refinements and admin tool additions: remove laugh reactions from prayer wall and daily content, add view counts to repost grid, admin-configurable per-field font family for the main app, activation code management in admin, video thumbnail regeneration, and admin ability to create workshops on behalf of users. All users can host workshops (can_host=true for everyone, no restriction).

</domain>

<decisions>
## Implementation Decisions

### Font Family System
- **Top 100 Google Fonts** as the curated selection list (not arbitrary input)
- **Per-text-field configuration** — admin assigns a font family to each text field/category independently (not one global font)
- **Family only** — admin controls typeface per field; weights and sizes remain as coded
- **Admin side loads all 100 fonts** for preview; main app loads only the selected fonts at runtime via Google Fonts with preconnect
- **Live preview** — admin sees sample text updating as they pick fonts per field
- **Searchable dropdown** with each font name rendered in its own typeface
- **Category filters** — Serif / Sans-Serif / Display / Handwriting / Monospace filter tabs alongside search
- **Grouped by section** — text fields organized under collapsible groups (e.g., Navigation, Feed Cards, Daily Post, Profile, Headings)
- **Per-field reset + Reset All** — each field has its own reset-to-default button, plus a global "Reset All" button
- **No global default** — each field is configured independently, no cascading global font
- **Section in admin platform settings** — not a dedicated page; collapsible section within existing admin settings
- **Preview + Publish flow** — admin previews how the app looks across fields before publishing changes to all users
- Claude will audit the codebase, build a list of distinct text field categories that can be grouped, and present for review during planning

### Activation Code Management
- **Dedicated admin page** at /admin/activation-codes
- **Batch generation only** — admin generates codes in batches (quantity input), no single-code generation
- **Never expire** — codes are valid forever until used
- **Single-use only** — each code works exactly once
- **No revocation** — once generated, codes stay active until used
- **No batch labels** — codes are a flat list sorted by creation date
- **Full tracking** — each code shows: code string, status (unused/used), created date, and which user redeemed it + when
- **CSV export with optional URL prefix** — admin can enter a URL prefix (e.g., `https://freeluma.com/signup?code=`) and export generates `URL+CODE` per row
- **Paginated table** — 50 codes per page with pagination controls
- **Status filter** — tabs or dropdown: All / Unused / Used
- **Summary stats cards** — total generated, used count, unused count displayed at top of page
- **Import existing codes** — old pending activation codes from the old database must be imported
- **Source indicator** — each code shows whether it was "imported" (from old DB) or "generated" (in new admin)

### Admin Proxy Workshop Creation
- **"Create on behalf" from admin workshop page** — button on /admin/workshops
- **Host selection via search** — admin types name/username to find and select the host user
- **Any user can be assigned** — no can_host restriction (admin override)
- **Auto-enable can_host** — if target user somehow has can_host=false, it gets set to true automatically
- **All users can host** — can_host=true for all users by default; no host privilege restriction in the platform
- **Host notification** — in-app notification sent to host: "Admin created a workshop for you: [title]"
- **Admin-visible attribution only** — admin dashboard shows "created by admin" tag; public view shows only the host
- **Same form + host picker** — reuses existing CreateWorkshopForm component with an added "Assign Host" search field
- **Host has full edit rights** — host can edit everything as if they created it themselves

### Reaction Removal
- **Delete existing haha reactions** from prayer wall (prayer_supports/reactions) and daily content (daily_reactions) tables via migration
- **Remove haha from reaction pickers** — prayer wall and daily content reaction components no longer show the laugh option
- Post reactions keep all 6 types (haha removal only applies to prayer + daily)

### Repost View Counts
- **Display original post's view count** on repost cards in the profile reposts grid
- **Viewing a repost increments the original post's view count** — repost is a window into the original
- **Bottom-right badge** with eye icon + count — same pattern as posts grid

### Video Thumbnail Regeneration
- **Individual only** — regen button per video in admin video management
- No bulk regeneration

### Claude's Discretion
- Exact list of text field categories for font system (will audit codebase and propose groupings)
- How to efficiently load only selected fonts on main app (preconnect strategy, dedup)
- Font preview implementation approach (lazy load on admin page)
- Activation code format and length (existing pattern uses O/0/I/l exclusion)
- Pagination controls style for activation code table
- Thumbnail regeneration UX (inline button, loading state)
- Migration query for deleting existing haha reactions
- View count tracking mechanism for posts (fire-and-forget increment pattern)

</decisions>

<specifics>
## Specific Ideas

- Font dropdown should show each font name rendered in that typeface — visual browsing experience
- CSV export needs a configurable URL prefix field so exported codes include full signup URLs (for NFC bracelets, printed cards)
- Repost view badges should match exactly how post view badges appear in the profile posts grid (bottom-right, eye icon + count)
- Old pending activation codes from the legacy database need to be imported alongside the new management system
- All users should have can_host=true — there is no host privilege restriction concept in this platform

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-platform-refinements-and-admin-tools*
*Context gathered: 2026-02-16*
