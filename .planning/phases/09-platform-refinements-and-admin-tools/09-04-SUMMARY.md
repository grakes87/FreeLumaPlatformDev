---
phase: 09-platform-refinements-and-admin-tools
plan: 04
subsystem: fonts
tags: [google-fonts, css-variables, font-loader, platform-settings]
dependency-graph:
  requires: []
  provides: [curated-font-list, font-field-definitions, font-loader-component, font-config-getter]
  affects: [09-06-admin-font-picker]
tech-stack:
  added: []
  patterns: [css-custom-properties, google-fonts-css2-api, platform-settings-kv]
key-files:
  created:
    - src/lib/fonts/google-fonts.ts
    - src/lib/fonts/font-fields.ts
    - src/components/layout/FontLoader.tsx
  modified:
    - src/hooks/usePlatformSettings.ts
    - src/app/layout.tsx
    - src/app/(app)/layout.tsx
decisions:
  - key: font-loader-placement
    choice: "(app)/layout.tsx inside providers, not root layout"
    reason: "platform-settings API requires authentication; FontLoader depends on usePlatformSettings which fetches from that API"
  - key: font-loading-strategy
    choice: "Single Google Fonts CSS2 link tag with all selected families"
    reason: "Minimizes HTTP requests; display=swap prevents FOIT; preconnect in root layout reduces latency"
  - key: css-variable-approach
    choice: "CSS custom properties on :root via dangerouslySetInnerHTML style tag"
    reason: "Allows any component to reference fonts via var(--font-field-name) without prop drilling; works with Tailwind arbitrary values"
metrics:
  duration: 3 min
  completed: 2026-02-16
---

# Phase 9 Plan 04: Font System Infrastructure Summary

**One-liner:** 100 curated Google Fonts, 16 configurable text field categories across 7 sections, and a FontLoader component that dynamically loads only selected fonts via CSS2 API with CSS custom property injection.

## What Was Done

### Task 1: Curated Font List and Text Field Category Definitions (7f03308)

Created two static data files that define the font system's data layer:

**google-fonts.ts** -- 100 curated Google Fonts with category metadata:
- 40 sans-serif (Roboto, Inter, Poppins, Montserrat, etc.)
- 25 serif (Playfair Display, Merriweather, Lora, etc.)
- 15 display (Oswald, Bebas Neue, Lobster, etc.)
- 15 handwriting (Dancing Script, Pacifico, Caveat, etc.)
- 5 monospace (Fira Code, JetBrains Mono, etc.)
- Sorted alphabetically within each category
- Exports `GoogleFont` interface, `CURATED_FONTS` array, `findCuratedFont()` lookup helper

**font-fields.ts** -- 16 text field categories across 7 sections:
- Navigation (1): nav_labels
- Headings (2): page_titles, section_headers
- Feed (3): feed_username, feed_body, feed_meta
- Daily Post (3): daily_verse, daily_reference, daily_subtitle
- Prayer Wall (2): prayer_body, prayer_meta
- Profile (3): profile_name, profile_bio, profile_stats
- General (2): body_default, button_labels
- Each field has key, label, cssVar, description, sampleText
- Exports `FONT_FIELDS` flat array, `FONT_SECTIONS` grouped, `buildFontConfig()` helper

### Task 2: FontLoader Component, Platform Settings Integration, Layout Preconnect (d7506c4)

**FontLoader component** (`src/components/layout/FontLoader.tsx`):
- Client component that reads `font_config` from platform settings
- Collects unique font families from config, filters out empty/inherit values
- Renders nothing when no custom fonts are configured (zero performance impact)
- When fonts are configured: generates a single Google Fonts CSS2 URL loading all families with weights 300-700
- Injects CSS custom properties on `:root` via `<style>` tag (e.g., `--font-nav-labels: 'Montserrat', sans-serif`)
- Uses font category from curated list for fallback stack

**usePlatformSettings hook** enhancement:
- Added `fontConfig` memoized getter that parses `font_config` JSON from settings
- Safe JSON parse with try/catch, defaults to empty object
- Added to return interface

**Root layout** (`src/app/layout.tsx`):
- Added preconnect links for `fonts.googleapis.com` and `fonts.gstatic.com` in `<head>`

**App layout** (`src/app/(app)/layout.tsx`):
- FontLoader rendered inside authenticated layout, after NotificationProvider, before AppShell

## Deviations from Plan

None -- plan executed exactly as written.

## How It Works

1. Admin sets `font_config` platform setting via API (JSON string mapping field keys to font families)
2. On page load, FontLoader reads config via `usePlatformSettings().fontConfig`
3. FontLoader generates a single Google Fonts CSS2 URL for all selected families
4. CSS custom properties are set on `:root` for each field
5. Components reference fonts via `var(--font-nav-labels)` etc.
6. When no config exists, FontLoader renders nothing -- no Google Fonts request, no CSS vars

## Next Phase Readiness

Plan 06 (admin font picker UI) can now build on this foundation:
- Font data: `CURATED_FONTS` for the picker dropdown, `FONT_SECTIONS` for the admin UI layout
- Runtime: FontLoader already handles loading and CSS injection
- Settings: `font_config` key in platform settings KV store
- Integration: Components can start using `var(--font-field-name)` CSS properties
