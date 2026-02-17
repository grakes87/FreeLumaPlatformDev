# Phase 12: Content Production Platform - Research

**Researched:** 2026-02-17
**Domain:** Content generation pipeline (AI text, TTS audio, SRT subtitles), creator management, admin UI, video recording, HeyGen AI video integration
**Confidence:** MEDIUM-HIGH (core patterns verified; some API details from official docs, some from search)

## Summary

Phase 12 introduces a comprehensive daily content production pipeline spanning AI text generation (Claude), TTS audio (ElevenLabs + Murf), SRT subtitle generation from audio timing data, creator management with round-robin assignment, an in-browser teleprompter/recording experience, admin content management with a 5-tab workflow, and HeyGen AI video integration for non-English creators.

The existing codebase already has the `@anthropic-ai/sdk` package installed and a working Claude integration pattern in the verse-generation route. The `daily_content` and `daily_content_translations` tables exist with audio_url and audio_srt_url columns already present on translations. The `srt-parser-2` package is installed (used by SubtitleDisplay component). B2 presigned upload, FFmpeg video processing, and SendGrid email patterns are all established.

**Primary recommendation:** Build the pipeline as server-side API routes with SSE streaming for real-time progress feedback. Use ElevenLabs SDK for English TTS (with-timestamps endpoint for SRT), Murf REST API for Spanish TTS (wordDurations response data for SRT), and direct REST calls for HeyGen video generation with webhook callbacks. Leverage existing patterns: PlatformSetting KV for API keys/voice IDs, B2 presigned upload for media, FFmpeg for video processing, SendGrid for creator notifications.

## Standard Stack

### Core (New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@elevenlabs/elevenlabs-js` | latest | English TTS with character-level timestamps | Official SDK; with-timestamps endpoint returns character timing for SRT |
| `murf` | latest | Spanish/non-English TTS | Official JS SDK; `wordDurations` in response for SRT timing |

### Already Installed (Leveraged)

| Library | Version | Purpose | How Used |
|---------|---------|---------|----------|
| `@anthropic-ai/sdk` | ^0.74.0 | AI text generation | Quotes, devotionals, camera scripts, meditation, prompts |
| `srt-parser-2` | ^1.2.3 | SRT parsing (client) | Already in SubtitleDisplay; used for client playback |
| `fluent-ffmpeg` + `ffmpeg-static` | installed | Video processing | Creator video compression + thumbnail extraction |
| `sharp` | ^0.34.5 | Image processing | Thumbnail post-processing |
| `@sendgrid/mail` | ^8.1.6 | Email notifications | Creator assignment/rejection emails |
| `@aws-sdk/client-s3` | ^3.988.0 | B2 storage | Audio files, SRT files, creator videos |
| `zod` | ^4.3.6 | Validation | All API input validation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ElevenLabs SDK | Direct REST fetch | SDK provides typed responses, auto-retry, timeout config |
| Murf SDK | Direct REST fetch | REST is fine; SDK may be thin wrapper. Use SDK if available, fallback to REST |
| HeyGen SDK | Direct REST fetch | Use direct REST -- HeyGen's JS SDK is stream-focused, REST is simpler for batch video generation |
| SSE for progress | WebSocket (Socket.IO) | SSE is simpler for unidirectional server-to-client progress; Socket.IO overkill for admin-only feature |

**Installation:**
```bash
npm install @elevenlabs/elevenlabs-js murf
```

Note: If `murf` npm package is unavailable or poorly maintained, fall back to direct REST API calls to `https://api.murf.ai/v1/speech/generate` with fetch. Murf's SDK availability should be verified at implementation time.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── content-pipeline/
│   │   ├── verse-selection.ts      # Random unused KJV verse logic
│   │   ├── text-generation.ts      # Claude API calls (quotes, devotionals, scripts, meditations, prompts)
│   │   ├── tts-elevenlabs.ts       # ElevenLabs TTS with timestamps
│   │   ├── tts-murf.ts             # Murf TTS with word durations
│   │   ├── srt-generator.ts        # Convert timing data -> SRT format string
│   │   ├── pipeline-runner.ts      # Orchestrates full day generation pipeline
│   │   └── assignment.ts           # Round-robin creator assignment logic
│   └── heygen/
│       └── index.ts                # HeyGen API client (create video, check status, webhook handler)
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── content-production/
│   │   │   │   ├── route.ts                    # GET month overview, stats
│   │   │   │   ├── generate/route.ts           # POST trigger generation (SSE streaming)
│   │   │   │   ├── regenerate/route.ts         # POST regenerate specific field
│   │   │   │   ├── creators/route.ts           # GET/POST creator CRUD
│   │   │   │   ├── creators/[id]/route.ts      # PUT/DELETE creator
│   │   │   │   ├── assign/route.ts             # POST auto-assign / reassign
│   │   │   │   ├── review/route.ts             # POST approve/reject/revert
│   │   │   │   ├── background-video/route.ts   # POST upload background video
│   │   │   │   └── heygen/route.ts             # POST trigger HeyGen batch
│   │   │   └── ...existing admin routes
│   │   ├── creator/
│   │   │   ├── assignments/route.ts      # GET creator's assignments
│   │   │   ├── stats/route.ts            # GET creator stats
│   │   │   ├── upload/route.ts           # POST submit video
│   │   │   └── content/[id]/route.ts     # GET full content for assigned day
│   │   └── webhooks/
│   │       └── heygen/route.ts           # POST HeyGen webhook callback
│   ├── (admin)/admin/
│   │   └── content-production/
│   │       └── page.tsx                  # Admin content production page (5 tabs)
│   └── (app)/creator/
│       ├── layout.tsx                    # Creator portal layout
│       ├── page.tsx                      # Creator dashboard
│       └── record/[id]/page.tsx          # Teleprompter recording page
└── components/
    ├── admin/content-production/
    │   ├── ContentProductionPage.tsx     # Main page with tabs
    │   ├── UnassignedTab.tsx
    │   ├── AssignedTab.tsx
    │   ├── PendingTab.tsx
    │   ├── CompletedTab.tsx
    │   ├── BackgroundVideosTab.tsx
    │   ├── DayCard.tsx                  # Expandable day card
    │   ├── GenerationProgressModal.tsx  # SSE progress overlay
    │   └── CreatorManager.tsx           # Creator CRUD UI
    └── creator/
        ├── CreatorDashboard.tsx
        ├── AssignmentList.tsx
        ├── Teleprompter.tsx             # Camera + script overlay
        └── RecordingControls.tsx
```

### Pattern 1: SSE Streaming for Generation Progress

**What:** Server-Sent Events for real-time pipeline progress feedback
**When to use:** Admin triggers "Generate Month" -- long-running operation (30+ API calls)
**Example:**
```typescript
// API route (server)
export async function POST(req: NextRequest) {
  // Validate admin auth...
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      for (let day = 1; day <= daysInMonth; day++) {
        send({ type: 'progress', day, total: daysInMonth, step: 'verse_selection' });
        // ... do work ...
        send({ type: 'progress', day, total: daysInMonth, step: 'tts_english' });
        // ... do work ...
      }
      send({ type: 'complete', generated: successCount, failed: failedDays });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Client component
const eventSource = new EventSource('/api/admin/content-production/generate?month=2026-03&mode=bible');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  setProgressLog(prev => [...prev, data]);
};
```

**Critical SSE note for Next.js App Router:** Return the Response immediately with the ReadableStream. The stream controller enqueues data asynchronously. Do NOT await the entire pipeline before returning -- this causes buffering and defeats real-time progress.

### Pattern 2: Idempotent Gap-Fill Pipeline

**What:** Generation only fills missing content, never overwrites
**When to use:** Every generation run (safety guarantee)
**Example:**
```typescript
async function generateDay(date: string, mode: 'bible' | 'positivity') {
  // Check what already exists
  const existing = await DailyContent.findOne({
    where: { post_date: date, mode, language: 'en' },
    include: [{ model: DailyContentTranslation, as: 'translations' }],
  });

  // If content row exists, check individual fields
  if (existing) {
    const translations = existing.translations || [];
    for (const bt of activeBibleTranslations) {
      const trans = translations.find(t => t.translation_code === bt.code);
      if (!trans?.chapter_text) { /* fetch verse text */ }
      if (!trans?.audio_url) { /* generate TTS */ }
      if (!trans?.audio_srt_url) { /* generate SRT */ }
    }
    if (!existing.lumashort_video_url) { /* needs creator video */ }
    return; // Only filled gaps
  }

  // No content exists -- generate everything
  // ...
}
```

### Pattern 3: PlatformSetting for API Configuration

**What:** Store API keys and voice IDs in PlatformSetting KV store
**When to use:** Admin-configurable external service settings
**Example:**
```typescript
// Keys to store:
// 'elevenlabs_api_key' - ElevenLabs API key
// 'elevenlabs_voice_id' - English voice ID
// 'murf_api_key' - Murf API key
// 'murf_voice_id' - Spanish voice ID (e.g., 'es-ES-natalie')
// 'heygen_api_key' - HeyGen API key

const voiceId = await PlatformSetting.get('elevenlabs_voice_id');
if (!voiceId) throw new Error('ElevenLabs voice not configured');
```

### Pattern 4: Creator Access Middleware

**What:** Middleware that checks user has linked LumaShortCreator record
**When to use:** Creator portal routes (/creator/*)
**Example:**
```typescript
// withCreator HOF -- follows withAuth/withAdmin pattern
export function withCreator(handler: (req: NextRequest, context: CreatorContext) => Promise<NextResponse>) {
  return withAuth(async (req: NextRequest, authContext: AuthContext) => {
    const { LumaShortCreator } = await import('@/lib/db/models');
    const creator = await LumaShortCreator.findOne({
      where: { user_id: authContext.user.id, active: true },
    });
    if (!creator) {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 403 });
    }
    return handler(req, { ...authContext, creator });
  });
}
```

### Anti-Patterns to Avoid

- **Client-side video compression:** Upload raw video, let server-side FFmpeg handle compression. Mobile browsers have unreliable MediaRecorder codecs and compression.
- **Storing API keys in env vars only:** Use PlatformSetting for admin-configurable keys (ElevenLabs voice, Murf voice, HeyGen avatar). Env vars for the base API keys is fine, but voice/avatar selection needs UI.
- **Synchronous generation:** A month of content involves 30+ Claude calls, 60+ TTS calls, 60+ SRT files. Must be streamed with progress feedback.
- **Multi-take video storage:** Decision is latest take replaces previous. Delete old B2 object before storing new one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SRT subtitle timing | Manual text-duration estimation | ElevenLabs `with-timestamps` + Murf `wordDurations` | Audio-derived timing is accurate; text estimation drifts |
| Video compression | Client-side canvas/MediaRecorder compression | Server-side FFmpeg (`fluent-ffmpeg`) | Mobile codec support varies wildly; server FFmpeg is consistent |
| Bible verse database | Scraping or manual entry | KJV has 31,102 verses; use a JSON/CSV seed file of all books/chapters/verses | Established datasets exist |
| Email sending | Custom SMTP | SendGrid via `@sendgrid/mail` (already established) | Deliverability, templates, tracking |
| File upload | Multipart form upload | B2 presigned URL pattern (already established) | Direct browser-to-B2, no server memory pressure |
| Character-to-word timing | Custom character grouping | Group by whitespace/punctuation boundaries from ElevenLabs alignment data | Standard NLP boundary detection |

**Key insight:** The TTS providers (ElevenLabs and Murf) return timing data in their responses -- ElevenLabs as character-level alignment, Murf as word-level durations. Building SRT from this data is a straightforward mapping, NOT a speech analysis problem. Do not use a separate speech-to-text service for SRT timing.

## Common Pitfalls

### Pitfall 1: SSE Buffering in Next.js App Router
**What goes wrong:** SSE chunks arrive all at once instead of incrementally
**Why it happens:** Next.js or proxies buffer the response until the stream closes
**How to avoid:**
- Return the Response immediately with the ReadableStream
- Do NOT `await` the pipeline work before returning
- Set `Cache-Control: no-cache` header
- Use `controller.enqueue()` inside an async `start()` callback
- Consider `Transfer-Encoding: chunked` header
**Warning signs:** Progress modal shows nothing, then dumps all logs at once

### Pitfall 2: ElevenLabs Rate Limits and Quotas
**What goes wrong:** TTS generation fails mid-month due to rate limiting or quota exhaustion
**Why it happens:** Generating 31 days x multiple translations = 60+ TTS calls in rapid succession
**How to avoid:**
- Add configurable delay between TTS calls (e.g., 500ms-1s)
- Check ElevenLabs plan quota before starting bulk generation
- On 429 response, implement exponential backoff
- Pipeline should skip-and-continue on failure, not abort
**Warning signs:** 429 responses, partial month generation

### Pitfall 3: ESV API Rate Limiting
**What goes wrong:** ESV API calls fail during bulk verse fetching
**Why it happens:** ESV API has rate limits (default 5000 calls/day for free tier)
**How to avoid:**
- Add 200ms delay between ESV API calls
- Cache aggressively -- verse text doesn't change
- Fetch ESV translations sequentially, not in parallel
- Consider fetching all translations for a verse in sequence before moving to next day
**Warning signs:** 403 or 429 from api.esv.org

### Pitfall 4: MediaRecorder Portrait Orientation
**What goes wrong:** Recorded video orientation doesn't match display
**Why it happens:** Mobile devices report orientation metadata differently; some browsers don't respect the `facingMode` constraint
**How to avoid:**
- Set `getUserMedia({ video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } } })`
- Portrait mode is natural when phone is held upright -- don't force rotation
- Test on both iOS Safari and Android Chrome -- they handle orientation metadata differently
- FFmpeg server-side can normalize orientation via `-metadata:s:v rotate=0`
**Warning signs:** Landscape video despite portrait recording; rotated playback

### Pitfall 5: Large Audio/Video File Upload Timeout
**What goes wrong:** Presigned URL upload times out or fails for large video files
**Why it happens:** Creator videos can be 50-100MB raw; default presigned URL expiry too short
**How to avoid:**
- Use 4-hour expiry for creator video uploads (matches existing video upload pattern)
- Show upload progress bar on client
- Upload raw video, compress server-side
**Warning signs:** Upload fails silently; 403 from B2 after presigned URL expires

### Pitfall 6: Claude API Token Limits
**What goes wrong:** Claude response truncated or request rejected
**Why it happens:** Generating all text for a day in a single prompt exceeds token limits
**How to avoid:**
- Make separate Claude calls per text field (quote, devotional, camera script, meditation, prompt)
- Each call is focused and short (500-1000 tokens output)
- Use `claude-sonnet-4-20250514` model (already established in codebase)
**Warning signs:** Truncated text, 400 errors from Anthropic API

### Pitfall 7: Used Verse Table Growing Large
**What goes wrong:** Random verse selection becomes slow with large used_verses table
**Why it happens:** Selecting random unused verse from 31,102 minus used set
**How to avoid:**
- Use `ORDER BY RAND() LIMIT 1` with NOT IN subquery for simplicity
- Or precompute: load all used verse references into a Set, pick from full verse list in JS
- At 365 verses/year, takes 85 years to exhaust -- performance is not a concern
**Warning signs:** Slow generation for first step of pipeline

## Code Examples

### ElevenLabs TTS with Timestamps
```typescript
// Source: ElevenLabs API docs - /v1/text-to-speech/{voice_id}/with-timestamps
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export async function generateTtsElevenLabs(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<{ audioBuffer: Buffer; alignment: CharacterAlignment }> {
  const client = new ElevenLabsClient({ apiKey });

  // Use with-timestamps endpoint for SRT generation data
  const response = await client.textToSpeech.convertWithTimestamps(voiceId, {
    text,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
  });

  // Response structure:
  // {
  //   audio_base64: string,
  //   alignment: {
  //     characters: string[],
  //     character_start_times_seconds: number[],
  //     character_end_times_seconds: number[]
  //   }
  // }

  const audioBuffer = Buffer.from(response.audio_base64, 'base64');
  return { audioBuffer, alignment: response.alignment };
}

// If SDK method not available, use direct REST:
async function elevenLabsTtsRest(text: string, voiceId: string, apiKey: string) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  return res.json();
}
```

### Murf TTS with Word Durations
```typescript
// Source: Murf API docs - POST /v1/speech/generate
export async function generateTtsMurf(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<{ audioUrl: string; wordDurations: WordDuration[] }> {
  const res = await fetch('https://api.murf.ai/v1/speech/generate', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voiceId, // e.g., 'es-ES-natalie'
      format: 'MP3',
    }),
  });

  const data = await res.json();
  // Response includes:
  // { audioFile: string (URL), audioLengthInSeconds: number, wordDurations: [...] }

  return {
    audioUrl: data.audioFile,
    wordDurations: data.wordDurations,
  };
}
```

### SRT Generation from Timing Data
```typescript
// Source: SRT format specification (SubRip)
interface WordTiming {
  word: string;
  startTime: number; // seconds
  endTime: number;   // seconds
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function generateSrt(words: WordTiming[], maxWordsPerLine: number = 8): string {
  const lines: string[] = [];
  let index = 1;

  for (let i = 0; i < words.length; i += maxWordsPerLine) {
    const chunk = words.slice(i, i + maxWordsPerLine);
    const start = formatSrtTime(chunk[0].startTime);
    const end = formatSrtTime(chunk[chunk.length - 1].endTime);
    const text = chunk.map(w => w.word).join(' ');

    lines.push(`${index}`);
    lines.push(`${start} --> ${end}`);
    lines.push(text);
    lines.push('');
    index++;
  }

  return lines.join('\n');
}

// Convert ElevenLabs character-level alignment to word timing
export function characterAlignmentToWords(alignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): WordTiming[] {
  const words: WordTiming[] = [];
  let currentWord = '';
  let wordStart = 0;
  let wordEnd = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];

    if (char === ' ' || char === '\n') {
      if (currentWord.trim()) {
        words.push({ word: currentWord.trim(), startTime: wordStart, endTime: wordEnd });
      }
      currentWord = '';
      wordStart = end; // Next word starts after the space
    } else {
      if (!currentWord) wordStart = start;
      currentWord += char;
      wordEnd = end;
    }
  }

  // Last word
  if (currentWord.trim()) {
    words.push({ word: currentWord.trim(), startTime: wordStart, endTime: wordEnd });
  }

  return words;
}
```

### HeyGen Video Generation
```typescript
// Source: HeyGen API docs - POST /v2/video/generate
export async function createHeygenVideo(
  avatarId: string,
  voiceId: string,
  scriptText: string,
  apiKey: string,
  callbackUrl?: string
): Promise<string> {
  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: avatarId,
          avatar_style: 'normal',
        },
        voice: {
          type: 'text',
          voice_id: voiceId,
          input_text: scriptText,
        },
        background: {
          type: 'color',
          value: '#000000',
        },
      }],
      dimension: { width: 1080, height: 1920 }, // Portrait
      callback_url: callbackUrl, // Webhook on completion
    }),
  });

  const data = await res.json();
  return data.data.video_id;
}

// Check status (polling fallback)
export async function checkHeygenStatus(videoId: string, apiKey: string) {
  const res = await fetch(
    `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
    { headers: { 'X-API-KEY': apiKey } }
  );
  return res.json();
  // { data: { status: 'pending'|'processing'|'completed'|'failed', video_url: string } }
}
```

### Teleprompter Recording (MediaRecorder)
```typescript
// Source: MDN MediaRecorder API
export async function startRecording(): Promise<{
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
}> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user', // Front camera
      width: { ideal: 1080 },
      height: { ideal: 1920 }, // Portrait
    },
    audio: true,
  });

  // Prefer MP4 on Safari, WebM on Chrome/Firefox
  const mimeType = MediaRecorder.isTypeSupported('video/mp4; codecs=avc1')
    ? 'video/mp4; codecs=avc1'
    : MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')
    ? 'video/webm; codecs=vp9,opus'
    : 'video/webm';

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerKbps: 2500000, // 2.5 Mbps
  });

  return { mediaRecorder, stream };
}
```

### Round-Robin Assignment
```typescript
// Source: Standard round-robin with capacity tracking
export async function autoAssign(month: string, mode: 'bible' | 'positivity') {
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  // Get eligible creators
  const creators = await LumaShortCreator.findAll({
    where: {
      active: true,
      ...(mode === 'bible' ? { can_bible: true } : { can_positivity: true }),
    },
    order: [['id', 'ASC']], // Deterministic ordering
  });

  // Count existing assignments this month per creator
  const assignmentCounts = new Map<number, number>();
  const existingAssignments = await DailyContent.findAll({
    where: {
      post_date: { [Op.between]: [`${month}-01`, `${month}-${daysInMonth}`] },
      mode,
      creator_id: { [Op.ne]: null },
    },
    attributes: ['creator_id'],
  });
  for (const a of existingAssignments) {
    assignmentCounts.set(a.creator_id, (assignmentCounts.get(a.creator_id) || 0) + 1);
  }

  // Get unassigned days
  const unassigned = await DailyContent.findAll({
    where: {
      post_date: { [Op.between]: [`${month}-01`, `${month}-${daysInMonth}`] },
      mode,
      creator_id: null,
    },
    order: [['post_date', 'ASC']],
  });

  let creatorIndex = 0;
  for (const day of unassigned) {
    // Find next creator with capacity
    let assigned = false;
    for (let i = 0; i < creators.length; i++) {
      const idx = (creatorIndex + i) % creators.length;
      const creator = creators[idx];
      const count = assignmentCounts.get(creator.id) || 0;
      if (count < creator.monthly_capacity) {
        await day.update({ creator_id: creator.id, status: 'assigned' });
        assignmentCounts.set(creator.id, count + 1);
        creatorIndex = (idx + 1) % creators.length;
        assigned = true;
        break;
      }
    }
    if (!assigned) break; // All creators at capacity
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-estimated SRT timing | Audio-derived character/word-level timestamps | ElevenLabs 2024 | Accurate lip-sync subtitles |
| Separate STT for SRT | TTS with-timestamps endpoint | ElevenLabs 2024 | Single API call produces audio + timing |
| Manual video generation | HeyGen Avatar IV engine | 2026 | Higher quality AI avatars |
| Server-side video upload | Presigned URL direct upload | Established | No server memory pressure |

**Deprecated/outdated:**
- `elevenlabs` npm package: Use `@elevenlabs/elevenlabs-js` (official)
- ElevenLabs v1 model: Use `eleven_multilingual_v2` for multi-language support
- Murf GEN1: Use GEN2 model for natural-sounding output

## Database Schema Design

### New Tables Required

**used_bible_verses**
```sql
CREATE TABLE used_bible_verses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  book VARCHAR(50) NOT NULL,
  chapter INT NOT NULL,
  verse INT NOT NULL,
  verse_reference VARCHAR(100) NOT NULL, -- "John 3:16" format
  used_date DATE NOT NULL, -- Date this verse was used
  daily_content_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_verse (book, chapter, verse),
  INDEX idx_used_date (used_date),
  FOREIGN KEY (daily_content_id) REFERENCES daily_content(id)
);
```

**luma_short_creators**
```sql
CREATE TABLE luma_short_creators (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  link_1 VARCHAR(500),
  link_2 VARCHAR(500),
  link_3 VARCHAR(500),
  languages JSON NOT NULL DEFAULT '["en"]', -- Array of language codes
  monthly_capacity INT NOT NULL DEFAULT 15,
  can_bible BOOLEAN NOT NULL DEFAULT TRUE,
  can_positivity BOOLEAN NOT NULL DEFAULT TRUE,
  is_ai BOOLEAN NOT NULL DEFAULT FALSE,
  heygen_avatar_id VARCHAR(255), -- Only for AI creators
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_active_mode (active, can_bible, can_positivity)
);
```

### DailyContent Table Extensions

The existing `daily_content` table needs new columns:
```sql
ALTER TABLE daily_content
  ADD COLUMN status ENUM('empty','generated','assigned','submitted','rejected','approved')
    NOT NULL DEFAULT 'empty',
  ADD COLUMN creator_id INT DEFAULT NULL,
  ADD COLUMN camera_script TEXT,
  ADD COLUMN devotional_reflection TEXT,
  ADD COLUMN meditation_script TEXT,
  ADD COLUMN background_prompt TEXT,
  ADD COLUMN rejection_note TEXT,
  ADD COLUMN creator_video_url VARCHAR(500),
  ADD COLUMN creator_video_thumbnail VARCHAR(500),
  ADD FOREIGN KEY (creator_id) REFERENCES luma_short_creators(id) ON DELETE SET NULL,
  ADD INDEX idx_status_mode_date (status, mode, post_date);
```

### DailyContentTranslation -- Already Has Needed Columns
The existing `daily_content_translations` table already has `audio_url` and `audio_srt_url` columns, plus `chapter_text` for verse text. No schema changes needed.

## Open Questions

Things that couldn't be fully resolved:

1. **Murf SDK availability**
   - What we know: Murf docs reference a JS SDK (`npm install murf`), but it may be a thin wrapper
   - What's unclear: Whether the package exists on npm and is maintained; documentation is Python-focused
   - Recommendation: Try `npm install murf` at implementation time. If unavailable, use direct REST API calls with fetch (documented endpoint: `POST https://api.murf.ai/v1/speech/generate`)

2. **Murf wordDurations response format**
   - What we know: Murf returns `wordDurations` in TTS response (confirmed in API docs search)
   - What's unclear: Exact shape of each word duration object (start/end times? or just duration per word?)
   - Recommendation: Make a test API call during implementation to inspect response shape. If only durations (not start/end), compute cumulative start times

3. **ElevenLabs SDK `convertWithTimestamps` method name**
   - What we know: The REST endpoint is `/v1/text-to-speech/{voice_id}/with-timestamps`
   - What's unclear: Exact SDK method name (may be `convertWithTimestamps` or `convert` with options)
   - Recommendation: Check SDK types at implementation time. Fall back to direct REST call if needed (example provided above)

4. **HeyGen webhook vs polling**
   - What we know: HeyGen supports both `callback_url` (webhook) and status polling endpoint
   - What's unclear: Whether webhook works reliably with Next.js API routes behind proxies
   - Recommendation: Implement both -- webhook as primary (immediate notification), polling as fallback (admin can manually retry). Webhook endpoint at `/api/webhooks/heygen`

5. **Bible verse seed data format**
   - What we know: KJV has 31,102 verses across 66 books, 1,189 chapters
   - What's unclear: Best source for a complete JSON/CSV of all verse references
   - Recommendation: Generate from the KJV book/chapter/verse structure (known counts per book). A seeder migration can populate the `used_bible_verses` exclusion list -- or better, store a complete verse index as a static JSON data file that the pipeline reads from

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/app/api/admin/verse-generation/route.ts` -- Claude API integration pattern
- Existing codebase: `src/lib/bible-api/index.ts` -- Bible API fetch pattern with ESV routing
- Existing codebase: `src/lib/db/models/DailyContent.ts` -- Table schema and associations
- Existing codebase: `src/lib/db/models/DailyContentTranslation.ts` -- Audio/SRT URL columns exist
- Existing codebase: `src/lib/storage/presign.ts` -- B2 presigned upload pattern
- Existing codebase: `src/lib/video/thumbnail.ts` -- FFmpeg thumbnail extraction pattern
- Existing codebase: `src/lib/notifications/create.ts` -- Notification dispatch pattern
- Existing codebase: `src/lib/email/index.ts` -- SendGrid email pattern

### Secondary (MEDIUM confidence)
- [ElevenLabs TTS with timestamps docs](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps) -- Character alignment response format
- [ElevenLabs JS SDK](https://github.com/elevenlabs/elevenlabs-js) -- `@elevenlabs/elevenlabs-js` package
- [Murf API quickstart](https://murf.ai/api/docs/introduction/quickstart) -- JS SDK `murf` package
- [Murf TTS endpoint](https://murf.ai/api/docs/api-reference/text-to-speech/generate) -- `POST /v1/speech/generate` with wordDurations
- [HeyGen create video](https://docs.heygen.com/reference/create-an-avatar-video-v2) -- V2 video generation endpoint
- [HeyGen quick start](https://docs.heygen.com/docs/quick-start) -- Authentication via X-API-KEY header
- [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) -- Browser video recording API

### Tertiary (LOW confidence)
- Murf JS SDK existence on npm -- referenced in docs but not independently verified
- HeyGen video generation timing (5-10 minutes per video) -- from search result, not official docs
- ElevenLabs SDK exact method names for with-timestamps -- inferred from REST endpoint naming

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- core libraries verified, existing codebase patterns established
- Architecture: HIGH -- follows existing patterns (withAdmin, PlatformSetting, B2 presigned, FFmpeg)
- TTS integration: MEDIUM -- API endpoints documented but exact SDK method signatures need runtime verification
- SRT generation: MEDIUM -- algorithm is straightforward but depends on actual timing data format from APIs
- HeyGen integration: MEDIUM -- REST API well-documented, webhook reliability unknown
- Teleprompter/MediaRecorder: MEDIUM -- browser API standard but mobile quirks exist
- Pitfalls: HIGH -- based on documented limitations and codebase experience

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- APIs are stable, SDKs may update)
