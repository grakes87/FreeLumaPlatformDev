---
status: testing
phase: 14-first-time-user-tutorial-walkthrough
source: 14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md
started: 2026-02-20T21:00:00Z
updated: 2026-02-20T21:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Tutorial Auto-Triggers for New User
expected: |
  Log in as a user who hasn't seen the tutorial (or reset via DB/API). After the main feed loads, a full-screen tutorial slideshow overlay should appear within ~1 second, covering the entire screen with a dark backdrop.
awaiting: user response

## Tests

### 1. Tutorial Auto-Triggers for New User
expected: Log in as a user who hasn't seen the tutorial (has_seen_tutorial=false). After the main feed loads, a full-screen tutorial slideshow overlay appears within ~1 second.
result: [pending]

### 2. Welcome Slideshow Content
expected: The slideshow shows multiple cards that can be swiped horizontally. Each card has a CSS-only illustration, title, and description. Pagination dots show progress at the bottom. Content should reference the user's mode (bible or positivity).
result: [pending]

### 3. Skip/Dismiss Tutorial
expected: A "Skip" button is visible during the slideshow. Tapping it immediately closes the tutorial overlay and marks it complete (won't show again on refresh).
result: [pending]

### 4. Coach Marks Phase
expected: After swiping through all slideshow cards and tapping the final button, the slideshow transitions to coach marks. A spotlight overlay highlights a specific UI element with a tooltip explaining what it does.
result: [pending]

### 5. Coach Mark Targets
expected: Coach marks sequentially highlight: (1) the daily content card, (2) the verse mode toggle (bible mode only), (3) the bottom navigation bar, (4) the reactions area. Each has a descriptive tooltip. Tapping advances to the next.
result: [pending]

### 6. Tutorial Completion Persists
expected: After the last coach mark, the tutorial closes. Refreshing the page or logging out and back in does NOT show the tutorial again.
result: [pending]

### 7. Replay Tutorial from Settings
expected: Go to Settings page. There is a "Help" section with a "Replay Tutorial" button (with subtitle "Watch the app introduction again"). Tapping it navigates to the home page and the tutorial starts again from the slideshow.
result: [pending]

### 8. Guest Users Don't See Tutorial
expected: Visit the daily post page as a guest (not logged in). No tutorial overlay appears.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps

[none yet]
