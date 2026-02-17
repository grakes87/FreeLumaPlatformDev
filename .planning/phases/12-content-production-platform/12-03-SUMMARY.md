---
phase: 12-content-production-platform
plan: 03
subsystem: content-pipeline
tags: [claude-api, tts, elevenlabs, murf, srt, text-generation, audio]
depends_on: ["12-01", "12-02"]
provides: ["text-generation-functions", "tts-audio-generation", "srt-subtitle-generation"]
affects: ["12-04", "12-05", "12-06"]
tech-stack:
  added: []
  patterns: ["sdk-with-rest-fallback", "pure-function-modules"]
key-files:
  created:
    - src/lib/content-pipeline/text-generation.ts
    - src/lib/content-pipeline/srt-generator.ts
    - src/lib/content-pipeline/tts-elevenlabs.ts
    - src/lib/content-pipeline/tts-murf.ts
  modified: []
decisions:
  - id: D12-03-01
    description: "ElevenLabs SDK with REST fallback for resilience"
  - id: D12-03-02
    description: "SRT generator handles both character-level and word-level timing formats"
  - id: D12-03-03
    description: "Text generation functions are pure (API key from env, no DB access)"
metrics:
  duration: 4 min
  completed: 2026-02-17
---

# Phase 12 Plan 03: Core Pipeline Libraries Summary

Claude API text generation (5 functions), ElevenLabs + Murf TTS with timing data, and SRT subtitle generator converting both provider formats to valid .srt output.

## What Was Built

### AI Text Generation Module (text-generation.ts)

Five exported async functions using the Anthropic Claude SDK (`claude-sonnet-4-20250514`):

1. **generatePositivityQuote()** -- Original motivational quote (1-3 sentences)
2. **generateDevotionalReflection(verseReference, verseText)** -- 4-6 sentence devotional reflection
3. **generateCameraScript(mode, content)** -- ~45-second spoken camera script (~110-120 words)
4. **generateMeditationScript(mode, content)** -- ~1-minute guided meditation (opening breath, visualization, affirmation, closing)
5. **generateBackgroundPrompt(mode, content)** -- Cinematic video prompt for Sora/Veo (scenery only, no people)

Each function follows the existing Anthropic SDK pattern from `verse-generation/route.ts`. API key from `process.env.ANTHROPIC_API_KEY`. All use `max_tokens: 1024`.

### ElevenLabs TTS Module (tts-elevenlabs.ts)

`generateTtsElevenLabs(text, voiceId, apiKey)` returns `{ audioBuffer: Buffer, alignment }` with character-level timestamps.

- Primary path: ElevenLabs SDK `convertWithTimestamps` method
- Fallback: Direct REST call to `/v1/text-to-speech/{voiceId}/with-timestamps`
- Custom `ElevenLabsRateLimitError` with retry-after value for 429 handling
- Uses `eleven_multilingual_v2` model, `mp3_44100_128` output format

### Murf TTS Module (tts-murf.ts)

`generateTtsMurf(text, voiceId, apiKey)` returns `{ audioBuffer: Buffer, wordDurations }` with word-level timing.

- Direct REST call to `https://api.murf.ai/v1/speech/generate`
- Downloads audio from returned URL
- Normalizes word durations (handles both start/end and duration-only formats)

### SRT Subtitle Generator (srt-generator.ts)

- `formatSrtTime(seconds)` -- Converts seconds to "HH:MM:SS,mmm" format
- `generateSrt(words, maxWordsPerLine)` -- Groups words into subtitle lines
- `characterAlignmentToWords(alignment)` -- Converts ElevenLabs character alignment to word timing
- `murfDurationsToWords(wordDurations)` -- Converts Murf word durations to word timing
- Defensive guards against undefined timing values in malformed API responses

## Key Integration Points

- `tts-elevenlabs.ts` -> `srt-generator.ts` via `characterAlignmentToWords()`
- `tts-murf.ts` -> `srt-generator.ts` via `murfDurationsToWords()`
- Pipeline runner will call text-generation functions, then TTS, then SRT generation

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| D12-03-01 | SDK + REST fallback for ElevenLabs | SDK method names may change across versions; REST fallback ensures resilience |
| D12-03-02 | Both character-level and word-level timing support | ElevenLabs returns character alignment, Murf returns word durations -- SRT generator normalizes both |
| D12-03-03 | Pure functions with no DB access | Caller passes config (API keys, voice IDs); modules are testable in isolation |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Defensive guards for undefined timing values**
- **Found during:** Task 1 verification
- **Issue:** Character alignment arrays could have mismatched lengths from malformed API data, causing NaN in SRT output
- **Fix:** Added nullish coalescing (`?? 0`) for timing array lookups
- **Files modified:** src/lib/content-pipeline/srt-generator.ts
- **Commit:** 434d4d3

## Verification Results

- All 4 files compile without TypeScript errors (project-level `tsc --noEmit`)
- SRT generation produces valid .srt format with correct timing
- `formatSrtTime` handles edge cases (0, fractional seconds, minutes, hours)
- `characterAlignmentToWords` correctly groups characters at whitespace boundaries
- `murfDurationsToWords` handles both start/end and duration-only formats
- Full pipeline chain tested: alignment -> words -> SRT output

## Next Phase Readiness

All core pipeline library modules are ready. The pipeline runner (12-04) can now orchestrate these modules to generate complete daily content sets.
