---
phase: 12-content-production-platform
plan: 02
subsystem: content-pipeline
tags: [bible-verse, kjv, verse-selection, elevenlabs, tts]
dependency-graph:
  requires: []
  provides:
    - "Complete KJV verse index (31,102 references)"
    - "Random unused verse selection function"
    - "ElevenLabs TTS SDK installed"
  affects:
    - "12-03 (text generation uses selected verse)"
    - "12-04 (TTS uses ElevenLabs SDK)"
    - "12-06 (pipeline runner calls selectRandomUnusedVerse)"
tech-stack:
  added:
    - "@elevenlabs/elevenlabs-js@2.36.0"
  patterns:
    - "Compact verse data expanded lazily via Proxy"
    - "Dynamic model import for DB dependency decoupling"
key-files:
  created:
    - "src/lib/content-pipeline/bible-verse-index.ts"
    - "src/lib/content-pipeline/verse-selection.ts"
  modified:
    - "package.json"
decisions:
  - key: "no-murf-sdk"
    value: "Murf SDK not installed; will use direct REST API calls"
    reason: "Murf npm package availability uncertain per RESEARCH.md"
  - key: "lazy-proxy-verse-index"
    value: "ALL_KJV_VERSES uses Proxy for lazy generation"
    reason: "Avoids 31K object allocation at module import time"
  - key: "verse-not-recorded-on-select"
    value: "selectRandomUnusedVerse does NOT write to used_bible_verses"
    reason: "Pipeline runner records after successful content creation for idempotency"
metrics:
  duration: "5 min"
  completed: "2026-02-17"
---

# Phase 12 Plan 02: NPM Dependencies & Verse Selection Summary

**One-liner:** ElevenLabs SDK installed + complete 31,102-verse KJV index with random unused verse selection

## What Was Done

### Task 1: Install npm dependencies
- Installed `@elevenlabs/elevenlabs-js@2.36.0` (ElevenLabs TTS SDK)
- Murf SDK intentionally omitted (will use direct REST API per RESEARCH.md guidance)
- 6 new packages added to node_modules (SDK + transitive deps)

### Task 2: KJV verse index + verse selection module
- **bible-verse-index.ts**: Compact representation of all 66 books with per-chapter verse counts, lazily expanded to 31,102 `VerseReference` objects via Proxy on first access
- **verse-selection.ts**: `selectRandomUnusedVerse()` queries UsedBibleVerse model for exclusion, filters the full index, returns a random unused verse
- Verse is NOT marked as used by this function -- pipeline runner handles that after content creation succeeds (idempotency guarantee)

## Verification Results

| Check | Result |
|-------|--------|
| `npm ls @elevenlabs/elevenlabs-js` | 2.36.0 installed |
| `ALL_KJV_VERSES.length === 31102` | PASS |
| First verse: Genesis 1:1 | PASS |
| Last verse: Revelation 22:21 | PASS |
| 66 unique books | PASS |
| selectRandomUnusedVerse imports | PASS |
| Spot check: Psalms 119:176, John 3:16 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 1 Corinthians chapter 16 verse count**
- **Found during:** Task 2 verification
- **Issue:** 1 Corinthians chapter 16 had 10 verses instead of correct 24, causing total to be 31,088 instead of 31,102
- **Fix:** Changed last element of 1 Corinthians array from 10 to 24
- **Files modified:** src/lib/content-pipeline/bible-verse-index.ts
- **Commit:** 6158951

## Commits

| Hash | Message |
|------|---------|
| 809fda1 | chore(12-02): install ElevenLabs TTS SDK |
| 6158951 | feat(12-02): KJV verse index and random verse selection |

## Next Phase Readiness

Plan 12-03 (text generation) can proceed -- it will use the verse reference from `selectRandomUnusedVerse()` as input for Claude API calls to generate quotes, devotionals, camera scripts, meditation scripts, and background prompts.
