---
status: testing
phase: 09-platform-refinements-and-admin-tools
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 09-04-SUMMARY.md, 09-05-SUMMARY.md, 09-06-SUMMARY.md
started: 2026-02-16T18:00:00Z
updated: 2026-02-16T18:00:00Z
---

## Current Test

number: 1
name: Haha reaction removed from daily content
expected: |
  On the daily post slide, tap/long-press the reaction area. The reaction picker should show 5 reactions (like, love, wow, sad, pray) but NOT the haha/laughing reaction.
awaiting: user response

## Tests

### 1. Haha reaction removed from daily content
expected: On the daily post slide, tap/long-press the reaction area. The reaction picker should show 5 reactions (like, love, wow, sad, pray) but NOT the haha/laughing reaction.
result: [pending]

### 2. Haha reaction removed from prayer wall
expected: On the prayer wall, tap the reaction area on a prayer card. The quick reaction picker should show 5 reactions (like, love, wow, sad, pray) but NOT the haha/laughing reaction.
result: [pending]

### 3. Post feed retains all 6 reactions
expected: On the main feed, tap the reaction area on a regular post. All 6 reactions should still be available including haha/laughing.
result: [pending]

### 4. Repost view count badges on profile
expected: Go to a profile page, switch to the Reposts tab. Repost grid items that have views should display a view count badge (eye icon with number), similar to video posts.
result: [pending]

### 5. Admin: Regenerate video thumbnails button
expected: In admin > Videos, each video card should show a "Regenerate thumbnail" button regardless of whether a thumbnail already exists (not just for videos missing thumbnails).
result: [pending]

### 6. Admin: Activation Codes nav link
expected: In the admin dashboard, the left navigation should show an "Activation Codes" item with a Key icon, positioned between Users and Videos.
result: [pending]

### 7. Admin: Activation code stats cards
expected: On the Activation Codes page, 3 summary cards at the top display: Total codes count, Used count (green accent), and Unused count (amber accent).
result: [pending]

### 8. Admin: Generate activation codes
expected: Click "Generate Codes" button, an inline form appears with quantity input (default 10) and optional mode hint. Submit to generate codes. New codes appear in the table below with status "Unused" and source "Generated".
result: [pending]

### 9. Admin: Activation code table features
expected: The codes table shows columns: Code (monospace font, click to copy with checkmark feedback), Status (green "Unused" / gray "Used" badges), Source (blue "Generated" / amber "Imported" badges), Created date, Redeemed By (if used), Redeemed At. Status filter tabs (All/Unused/Used) work. Pagination shows "Page X of Y" with Previous/Next buttons.
result: [pending]

### 10. Admin: CSV export
expected: Click the export/download button, optionally enter a URL prefix. A CSV file downloads containing the activation codes matching the current filter.
result: [pending]

### 11. Admin: Create workshop on behalf of user
expected: In admin > Workshops, click "Create on Behalf" button. A modal opens with a host search input. Search for a user, select them, then fill out workshop details (title, description, category, date/time, duration, privacy). Submit creates the workshop assigned to the selected host user.
result: [pending]

### 12. Admin: Workshop admin attribution badge
expected: After creating a workshop on behalf of a user, the workshop card in the admin workshops list shows an indigo "Created by admin" badge.
result: [pending]

### 13. Admin: Font Family settings section
expected: In admin > Settings, a "Font Family" collapsible section appears (with a Type icon). Clicking it expands to reveal the font configuration UI.
result: [pending]

### 14. Admin: Font picker with searchable dropdown
expected: Inside Font Family settings, expand a section (e.g., "Feed"). Click a field's dropdown. A searchable picker appears with category filter tabs (All, Sans-Serif, Serif, Display, Handwriting, Monospace). Each font name is rendered in its own typeface. Selecting a font shows a live preview with sample text.
result: [pending]

### 15. Admin: Font publish and apply
expected: After selecting fonts for one or more fields, a "Publish Changes" button becomes active. Clicking it saves the font configuration. Refreshing the app, the selected fonts are applied to the corresponding UI elements via CSS custom properties (e.g., feed body text uses the selected font).
result: [pending]

## Summary

total: 15
passed: 0
issues: 0
pending: 15
skipped: 0

## Gaps

[none yet]
