---
phase: 13-sms-notifications
plan: 05
title: "Settings UI - Phone & SMS Toggles"
subsystem: settings-ui
tags: [sms, phone-verification, otp, settings-ui, react-phone-number-input]
depends_on:
  requires: ["13-03", "13-04"]
  provides: ["PhoneNumberSection component with OTP flow", "SMS toggles in settings page"]
  affects: ["13-06", "13-07"]
tech-stack:
  added: []
  patterns: ["OTP verification flow", "conditional toggle rendering", "reusable fetchSettings callback"]
key-files:
  created:
    - src/components/settings/PhoneNumberSection.tsx
  modified:
    - src/app/(app)/settings/page.tsx
decisions:
  - id: "sms-toggles-conditional"
    choice: "SMS toggles only visible when phone verified, per-category only when global SMS enabled"
    reason: "Progressive disclosure - don't show options user can't use"
metrics:
  duration: "3 min"
  completed: "2026-02-18"
---

# Phase 13 Plan 05: Settings UI - Phone & SMS Toggles Summary

**One-liner:** PhoneNumberSection with react-phone-number-input OTP verification flow + conditional SMS notification toggles in settings page.

## What Was Done

### Task 1: PhoneNumberSection Component
- Created `src/components/settings/PhoneNumberSection.tsx` as a `use client` component
- Three visual states:
  1. **Enter phone:** International phone input (react-phone-number-input, default US) with "Send Verification Code" button
  2. **OTP verification:** Disabled phone display + 6-digit code input + "Verify" button + resend link with 60s cooldown timer
  3. **Verified:** Phone number with green checkmark + "Verified" badge + "Change Number" link
- POST to `/api/sms/verify` to send OTP, PUT to `/api/sms/verify` to verify code
- Dark mode CSS overrides for react-phone-number-input using `[data-theme="dark"]` and `.dark` selectors
- Error display, loading spinners, cleanup on unmount

### Task 2: Settings Page Integration
- Updated Settings interface with phone/SMS fields (phone, phone_verified, sms_notifications_enabled, 5 per-category sms toggles)
- Imported PhoneNumberSection and Smartphone icon
- Extracted `fetchSettings()` from inline useEffect into a reusable `useCallback` so PhoneNumberSection can trigger a re-fetch after verification
- Added Phone Number section card between Privacy and Notifications sections
- Added SMS Notifications sub-section inside Notifications card after quiet hours:
  - Only renders when `phone_verified` is true
  - Global "Enable SMS" toggle (Smartphone icon) as master switch
  - 5 per-category toggles (DM, Follow, Prayer, Daily Reminder, Workshop Events) only when global SMS is enabled
  - Uses same ToggleRow and Divider components as email toggles
  - All SMS toggles auto-save with existing debounced saveSettings pattern

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. `npx tsc --noEmit` passes cleanly
2. PhoneNumberSection component renders 3 states (input, OTP, verified)
3. Settings page shows phone section before notifications
4. SMS toggles only visible when phone_verified is true
5. Per-category SMS toggles only visible when sms_notifications_enabled is true
6. Auto-save uses existing debounced saveSettings pattern

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | c9ced5f | feat(13-05): create PhoneNumberSection component with OTP verification flow |
| 2 | 0a754fb | feat(13-05): integrate phone section and SMS toggles into settings page |
