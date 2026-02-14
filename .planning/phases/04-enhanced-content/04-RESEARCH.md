# Phase 4: Enhanced Content - Research

**Researched:** 2026-02-13
**Domain:** Video library, account lifecycle, admin moderation
**Confidence:** HIGH (patterns largely follow existing codebase conventions)

## Summary

Phase 4 covers three distinct feature domains: (1) a Netflix-style video library with admin-uploaded content stored in Backblaze B2, complete with progress tracking and reactions; (2) account lifecycle management including deactivation, deletion with 30-day grace period, email change with verification, password change with security alerts, connected OAuth account management, and activity streaks; and (3) an enhanced admin moderation system with grouped report queue, user bans, moderator roles, audit logging, and user management.

The project already has established patterns for nearly every technical requirement. The existing B2 storage with presigned URLs, Sequelize paranoid soft-delete on User model, reaction system (6 types), createNotification() pipeline, withAdmin middleware, email templates with nodemailer, and Socket.IO notifications all provide direct foundations. The primary new technology needed is ffmpeg for server-side video thumbnail extraction and OpenAI Whisper API for caption generation.

**Primary recommendation:** Extend existing patterns (presigned upload, ListenLog-style progress tracking, reaction model, withAdmin middleware) rather than introducing new architectural patterns. The only new dependencies needed are `fluent-ffmpeg` + `ffmpeg-static` for thumbnail generation and OpenAI's API for caption auto-generation.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@aws-sdk/client-s3` | ^3.988.0 | B2 storage operations | Already used for all media uploads |
| `@aws-sdk/s3-request-presigner` | ^3.988.0 | Presigned upload/download URLs | Already used for avatar/post/chat media |
| `sequelize` | ^6.37.7 | ORM with paranoid soft-delete | Already used throughout; User model already has `paranoid: true` |
| `jose` | ^6.1.3 | Purpose-scoped JWT tokens | Already used for email verification tokens |
| `nodemailer` | ^8.0.1 | Transactional emails | Already used for verification/password-reset/notification emails |
| `sharp` | ^0.34.5 | Image processing (thumbnail post-processing) | Already installed for avatar processing |
| `zod` | ^4.3.6 | Request validation | Already used in all API routes |
| `srt-parser-2` | ^1.2.3 | SRT subtitle parsing | Already installed in project |
| `node-cron` | ^3.0.3 | Scheduled jobs (grace period cleanup, streak calculation) | Already used for email scheduler |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fluent-ffmpeg` | ^2.1 | Node.js FFmpeg wrapper for thumbnail extraction | Video upload processing (extract frame for thumbnail) |
| `ffmpeg-static` | ^5.3 | Static FFmpeg binary (no system install needed) | Provides ffmpeg binary path for fluent-ffmpeg |
| `@types/fluent-ffmpeg` | ^2.1 | TypeScript types | Dev dependency |
| `openai` | ^4.x | OpenAI API client for Whisper transcription | Caption auto-generation from video audio |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fluent-ffmpeg + ffmpeg-static | child_process.spawn with system ffmpeg | fluent-ffmpeg provides cleaner API; ffmpeg-static bundles binary for portability |
| OpenAI Whisper API | Local whisper.cpp or self-hosted Whisper | API at $0.006/min is cheap and avoids GPU/server requirements; self-hosted only makes sense at massive scale |
| Native HTML5 `<video>` element | react-player npm package | Native HTML5 video is sufficient for single-file MP4 streaming; react-player adds unnecessary abstraction for this simple use case |
| Sequelize paranoid (soft delete) | Custom `status` field | User model already uses paranoid; adding a `status` column alongside `deleted_at` for deactivation is cleaner than changing the existing pattern |

**Installation:**
```bash
npm install fluent-ffmpeg ffmpeg-static openai
npm install -D @types/fluent-ffmpeg
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (app)/
│   │   ├── watch/              # Video library pages (renamed from animations)
│   │   │   ├── page.tsx        # Netflix-style library home
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Video detail page
│   │   └── settings/
│   │       └── page.tsx        # Extended settings (add account section, stats, deactivate/delete)
│   ├── (admin)/
│   │   └── admin/
│   │       ├── moderation/
│   │       │   └── page.tsx    # Enhanced moderation queue
│   │       ├── videos/
│   │       │   └── page.tsx    # Video management (upload, edit, categories)
│   │       └── users/
│   │           └── page.tsx    # Enhanced user management (bans, roles)
│   └── api/
│       ├── videos/             # Video CRUD + listing
│       │   ├── route.ts        # GET (list), POST (create - admin)
│       │   └── [id]/
│       │       ├── route.ts    # GET (detail), PUT (update), DELETE
│       │       └── progress/
│       │           └── route.ts # PUT (save progress)
│       ├── video-reactions/    # Video reactions
│       │   └── route.ts
│       ├── video-categories/   # Admin category management
│       │   └── route.ts
│       ├── auth/
│       │   ├── change-email/   # Email change with verification
│       │   │   └── route.ts
│       │   ├── verify-email-change/  # Confirm new email
│       │   │   └── route.ts
│       │   ├── link-provider/  # Link OAuth provider
│       │   │   └── route.ts
│       │   └── unlink-provider/ # Unlink OAuth provider
│       │       └── route.ts
│       ├── account/
│       │   ├── deactivate/     # Account deactivation
│       │   │   └── route.ts
│       │   ├── delete/         # Account deletion (30-day grace)
│       │   │   └── route.ts
│       │   ├── stats/          # Account stats + streak
│       │   │   └── route.ts
│       │   └── reactivate/     # Reactivation on login
│       │       └── route.ts
│       └── admin/
│           ├── moderation/     # Enhanced moderation (existing, extend)
│           │   ├── route.ts
│           │   └── [id]/
│           │       └── route.ts
│           ├── bans/           # Ban management
│           │   └── route.ts
│           ├── audit-log/      # Moderation audit trail
│           │   └── route.ts
│           └── moderation-stats/ # Moderation dashboard stats
│               └── route.ts
├── components/
│   ├── video/                  # Video-specific components
│   │   ├── VideoPlayer.tsx     # Full-screen immersive player
│   │   ├── VideoCard.tsx       # Thumbnail card for rows
│   │   ├── HeroBanner.tsx      # Auto-play hero section
│   │   ├── CategoryRow.tsx     # Horizontal scrollable row
│   │   └── VideoReactionBar.tsx # Reaction bar for video detail
│   └── admin/
│       ├── VideoUploadForm.tsx # Admin video upload
│       └── ModerationQueue.tsx # Enhanced moderation UI
├── lib/
│   ├── db/
│   │   ├── models/
│   │   │   ├── Video.ts           # Video model
│   │   │   ├── VideoCategory.ts   # Category model for videos
│   │   │   ├── VideoProgress.ts   # Per-user watch progress
│   │   │   ├── VideoReaction.ts   # Reactions on videos
│   │   │   ├── Ban.ts             # User ban records
│   │   │   ├── ModerationLog.ts   # Audit log entries
│   │   │   └── ActivityStreak.ts  # Daily activity tracking
│   │   └── migrations/
│   │       ├── 043-create-video-categories.cjs
│   │       ├── 044-create-videos.cjs
│   │       ├── 045-create-video-progress.cjs
│   │       ├── 046-create-video-reactions.cjs
│   │       ├── 047-add-user-status-fields.cjs
│   │       ├── 048-create-bans.cjs
│   │       ├── 049-create-moderation-logs.cjs
│   │       ├── 050-create-activity-streaks.cjs
│   │       ├── 051-add-role-to-users.cjs
│   │       └── 052-add-shared-video-to-messages.cjs
│   └── video/
│       ├── thumbnail.ts       # FFmpeg thumbnail extraction
│       └── captions.ts        # Whisper API caption generation
```

### Pattern 1: Video Progress Tracking (extends ListenLog pattern)
**What:** Per-user video watch progress, modeled identically to the existing ListenLog
**When to use:** Every video playback session sends periodic progress updates

The existing ListenLog model tracks `user_id`, `daily_content_id`, `listen_seconds`, and `completed`. VideoProgress should follow the same idempotent upsert pattern used in `/api/listen-log`:

```typescript
// Source: existing /api/listen-log/route.ts pattern
// VideoProgress model: user_id, video_id, watched_seconds, duration_seconds, completed, last_position
// API: PUT /api/videos/[id]/progress

const existing = await VideoProgress.findOne({
  where: { user_id, video_id },
});

if (existing) {
  const updates: Partial<VideoProgressAttributes> = {};
  // Take the max watched_seconds (cumulative)
  if (watched_seconds > existing.watched_seconds) {
    updates.watched_seconds = watched_seconds;
  }
  // Always update last_position (for resume playback)
  updates.last_position = last_position;
  // Once completed, stays completed
  if (completed && !existing.completed) {
    updates.completed = true;
  }
  if (Object.keys(updates).length > 0) {
    await existing.update(updates);
  }
} else {
  await VideoProgress.create({ user_id, video_id, watched_seconds, duration_seconds, last_position, completed: false });
}
```

### Pattern 2: Video Upload with Presigned URL (extends existing upload pattern)
**What:** Admin uploads video file directly to B2 via presigned URL, then server generates thumbnail and captions
**When to use:** Admin video creation flow

Follows the existing presigned URL pattern from `/api/upload/presigned`:
```typescript
// 1. Admin requests presigned URL: GET /api/upload/presigned?type=video&contentType=video/mp4
// 2. Admin uploads file directly to B2
// 3. Admin submits video metadata: POST /api/videos with { title, description, category_id, video_url, duration }
// 4. Server-side: extract thumbnail frame at ~10% mark, upload to B2
// 5. Server-side: extract audio, send to Whisper API, save WebVTT captions to B2
```

### Pattern 3: Account Status Management (extends User paranoid pattern)
**What:** User model already has `paranoid: true` with `deleted_at`. Add `status` and `deactivated_at` fields.
**When to use:** Deactivation (instant reversible), deletion (30-day grace), ban enforcement

```typescript
// User model additions:
// status: 'active' | 'deactivated' | 'pending_deletion' | 'banned'
// deactivated_at: Date | null
// deletion_requested_at: Date | null (for 30-day countdown)
// ban_expires_at: Date | null

// Login flow (existing /api/auth/login):
// After password verification, check user.status:
// - 'deactivated': auto-reactivate (set status='active', deactivated_at=null)
// - 'pending_deletion': cancel deletion (set status='active', deletion_requested_at=null)
// - 'banned': check ban_expires_at, return suspension message if still banned
// - 'active': proceed normally
```

### Pattern 4: Ban Enforcement Middleware
**What:** Lightweight check in withAuth that verifies user is not banned
**When to use:** Every authenticated API request

```typescript
// Extend existing withAuth in src/lib/auth/middleware.ts:
// After JWT verification, do a lightweight status check.
// IMPORTANT: Do NOT query DB on every request. Instead:
// 1. Add 'status' to JWT payload (already has id, email)
// 2. On ban/unban, invalidate the user's JWT (they must re-login)
// OR: Cache ban status in memory with short TTL

// Recommended approach: Add status check only to withAuth, using a lightweight
// cached lookup. The JWT already contains user.id - use a Map<userId, BanInfo>
// that's populated lazily and refreshed every 60 seconds via node-cron.
```

### Pattern 5: Moderator Role (extends withAdmin pattern)
**What:** Moderator role with limited permissions (can review reports, warn users, but cannot ban)
**When to use:** Moderation routes need role-differentiated access

```typescript
// New middleware: withModerator (allows admin OR moderator)
// Extends withAdmin pattern:
export function withModerator(handler: AuthHandler) {
  return withAuth(async (req, context) => {
    const { User } = await import('@/lib/db/models');
    const dbUser = await User.findByPk(context.user.id, {
      attributes: ['id', 'is_admin', 'role'],
    });
    if (!dbUser || (!dbUser.is_admin && dbUser.role !== 'moderator')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, { ...context, isAdmin: dbUser.is_admin });
  });
}
```

### Pattern 6: Notification Types Extension
**What:** Add new notification types for video library and moderation
**When to use:** New video added, content removed, ban issued, warning sent

```typescript
// Extend src/lib/notifications/types.ts:
// New NotificationType values: 'new_video', 'content_removed', 'warning', 'ban'
// New NotificationEntityType values: 'video'
// Must also update the Notification model ENUM via migration
```

### Anti-Patterns to Avoid
- **Don't stream video through the Node.js server:** B2 supports byte-range requests natively. Serve the B2 public URL (or CDN URL) directly to the `<video>` element. Never proxy video bytes through Next.js API routes.
- **Don't add video processing to the upload API route:** Thumbnail extraction and caption generation are slow (10-60s). Run them asynchronously after the video metadata is saved. Return the video record immediately, then process in background.
- **Don't hard-delete user data immediately on account deletion:** Use the existing paranoid soft-delete. The 30-day grace period means `deletion_requested_at` is set, and a cron job permanently deletes after 30 days.
- **Don't put ban check in Next.js middleware/proxy.ts:** The Next.js 16 proxy.ts (formerly middleware.ts) is a lightweight routing layer not suited for DB queries. Keep ban enforcement in the existing `withAuth` HOF.
- **Don't modify existing JWT structure for ban checks:** Instead of adding fields to JWT (which would require re-signing), use a lightweight in-memory cache or direct DB check in withAuth. The JWT is only refreshed on login.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video thumbnail from frame | Custom canvas extraction | `fluent-ffmpeg` + `ffmpeg-static` | Server-side extraction is more reliable; handles all codecs; client-side canvas approach is unreliable for many video formats |
| Caption/subtitle generation | Manual SRT authoring UI | OpenAI Whisper API ($0.006/min) | Automatic, supports 99+ languages, returns timestamped word-level output; manual authoring is infeasible at scale |
| WebVTT subtitle parsing | Custom parser | Existing `srt-parser-2` (already installed) + simple SRT-to-VTT converter | SRT and VTT are nearly identical; srt-parser-2 handles parsing, add `WEBVTT` header for VTT format |
| Video player controls | Custom from scratch | Native HTML5 `<video>` element with custom React overlay | The `<video>` element provides play/pause, seek, volume, fullscreen natively; just style the controls |
| Streak calculation | Complex real-time calculation | Daily cron job that checks yesterday's activity | Streaks only change once per day; a cron job at midnight (per timezone) is simpler and more reliable than real-time calculation |
| Account deletion cleanup | Manual cascade queries | Sequelize paranoid `destroy({ force: true })` + cascading model relationships | Sequelize handles cascading deletes when force is used on paranoid models |
| Email change verification | Custom token system | Existing purpose-scoped JWT pattern from `send-verification/route.ts` | Already have `SignJWT` with `purpose: 'email_verification'`; create a new purpose like `'email_change'` with the new email in payload |

**Key insight:** The existing codebase has established patterns for every core concern (auth, storage, notifications, email, reactions, soft-delete). Phase 4 should extend these patterns, not introduce parallel systems.

## Common Pitfalls

### Pitfall 1: Video Streaming CORS Issues
**What goes wrong:** `<video>` element fails to load from B2 direct URL due to CORS
**Why it happens:** B2 buckets need CORS rules configured to allow the app's origin
**How to avoid:** Ensure B2 bucket CORS configuration includes the app's domain. The existing CDN_BASE_URL pattern already handles this for images; verify it works for video MIME types. Alternatively, use presigned GET URLs which bypass CORS.
**Warning signs:** Video element shows error but network tab shows blocked/CORS error

### Pitfall 2: Large Video Uploads Timing Out
**What goes wrong:** Presigned PUT URL expires before large video upload completes
**Why it happens:** Default presigned URL expiry is 3600s (1 hour). Large videos on slow connections may exceed this.
**How to avoid:** For video uploads specifically, generate presigned URLs with longer expiry (e.g., 4 hours). The existing `getUploadUrl()` already accepts `expiresIn` parameter.
**Warning signs:** Upload succeeds for small files but fails for larger ones

### Pitfall 3: Account Deletion Race Conditions
**What goes wrong:** User requests deletion, then logs in during grace period, but cron job still deletes
**Why it happens:** Cron job checks `deletion_requested_at` without checking if user has since reactivated
**How to avoid:** On re-login during grace period, clear both `deletion_requested_at` AND set `status` back to `'active'`. Cron job should check `status === 'pending_deletion'` AND `deletion_requested_at < 30 days ago`.
**Warning signs:** User reports account deleted despite logging in recently

### Pitfall 4: Ban Check Performance
**What goes wrong:** Adding a DB query to every authenticated request (in withAuth) causes latency spike
**Why it happens:** Every API call now hits the database to check ban status
**How to avoid:** Use an in-memory cache (simple Map with TTL) for ban status. Populate on first check, refresh every 60s. When admin bans a user, also invalidate the cache entry. For the initial implementation, a simple DB query in withAuth is acceptable since User.findByPk is indexed by primary key and fast.
**Warning signs:** API response times increase noticeably after adding ban checks

### Pitfall 5: Deactivated User Content Visibility
**What goes wrong:** Deactivated user's posts still show their full profile info
**Why it happens:** Content queries join on User table but don't check user status
**How to avoid:** When rendering posts/comments, check the author's status. If `deactivated`, show "Account deactivated" placeholder. If `pending_deletion`, hide content. Use a conditional in the query or a post-query transformation.
**Warning signs:** Deactivated profiles still show full names and avatars in feeds

### Pitfall 6: FFmpeg Binary Not Found in Production
**What goes wrong:** Thumbnail extraction fails in production because ffmpeg isn't installed
**Why it happens:** Development machines have ffmpeg installed globally, but production servers may not
**How to avoid:** Use `ffmpeg-static` package which bundles the binary. Set `fluent-ffmpeg`'s path to the static binary: `ffmpeg.setFfmpegPath(ffmpegStatic)`.
**Warning signs:** Works locally, fails on deploy with "ffmpeg not found" error

### Pitfall 7: Notification ENUM Migration
**What goes wrong:** Adding new notification types requires ALTER TABLE on MySQL ENUM columns
**Why it happens:** MySQL ENUM changes require the complete list of values
**How to avoid:** Migration must use raw SQL: `ALTER TABLE notifications MODIFY COLUMN type ENUM('follow', 'follow_request', 'reaction', 'comment', 'prayer', 'message', 'mention', 'group_invite', 'daily_reminder', 'new_video', 'content_removed', 'warning', 'ban')`. Same for entity_type.
**Warning signs:** Migration fails with ENUM-related error

### Pitfall 8: Streak Timezone Handling
**What goes wrong:** User's streak breaks despite being active, because server uses UTC for day boundary
**Why it happens:** A user active at 11pm EST has their activity recorded as next day UTC
**How to avoid:** Store streak data with the user's configured timezone (already in User.timezone). The cron job that calculates streaks should convert activity timestamps to the user's timezone before determining which "day" an activity belongs to.
**Warning signs:** Users in western timezones report incorrect streak counts

## Code Examples

Verified patterns from the existing codebase:

### Video Model Definition
```typescript
// Source: follows existing DailyContent model pattern
// File: src/lib/db/models/Video.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VideoAttributes {
  id: number;
  title: string;
  description: string | null;
  category_id: number;
  video_url: string;        // B2 public URL
  thumbnail_url: string | null;  // Auto-generated from video frame
  caption_url: string | null;    // WebVTT file URL in B2
  duration_seconds: number;
  view_count: number;
  is_hero: boolean;         // Featured in hero banner
  published: boolean;
  uploaded_by: number;       // Admin user ID
  created_at: Date;
  updated_at: Date;
}
// ... standard Sequelize model definition with paranoid: false (admin manages deletion)
```

### Thumbnail Extraction with FFmpeg
```typescript
// Source: fluent-ffmpeg docs + ffmpeg-static
// File: src/lib/video/thumbnail.ts
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import sharp from 'sharp';

// Set the path to the static ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegStatic as string);

export async function extractThumbnail(
  videoUrl: string,
  seekPercent: number = 10
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    ffmpeg(videoUrl)
      .seekInput(`${seekPercent}%`)
      .frames(1)
      .format('image2pipe')
      .outputOptions('-vcodec', 'mjpeg')
      .on('error', reject)
      .pipe()
      .on('data', (chunk: Buffer) => chunks.push(chunk))
      .on('end', async () => {
        // Post-process with sharp (resize to 16:9 thumbnail)
        const raw = Buffer.concat(chunks);
        const thumbnail = await sharp(raw)
          .resize(640, 360, { fit: 'cover' })
          .webp({ quality: 80 })
          .toBuffer();
        resolve(thumbnail);
      });
  });
}
```

### Caption Generation with Whisper
```typescript
// Source: OpenAI API docs
// File: src/lib/video/captions.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateCaptions(audioBuffer: Buffer, filename: string): Promise<string> {
  const file = new File([audioBuffer], filename, { type: 'audio/mp4' });

  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'vtt', // WebVTT format directly
  });

  return transcription; // WebVTT string content
}
```

### Ban Model
```typescript
// Source: follows existing Report model pattern
// File: src/lib/db/models/Ban.ts
export interface BanAttributes {
  id: number;
  user_id: number;
  banned_by: number;        // Admin who issued ban
  reason: string;
  duration: '24h' | '7d' | '30d' | 'permanent';
  expires_at: Date | null;  // null = permanent
  lifted_at: Date | null;   // Set when ban is manually lifted
  created_at: Date;
  updated_at: Date;
}
```

### ModerationLog (Audit Trail)
```typescript
// Source: new model, follows project conventions
// File: src/lib/db/models/ModerationLog.ts
export interface ModerationLogAttributes {
  id: number;
  admin_id: number;
  action: 'remove_content' | 'warn_user' | 'ban_user' | 'unban_user' | 'edit_user' | 'dismiss_report';
  target_user_id: number | null;
  target_content_type: 'post' | 'comment' | 'video' | null;
  target_content_id: number | null;
  reason: string | null;
  metadata: string | null;  // JSON string for extra details
  created_at: Date;
}
```

### Email Change Flow (extends send-verification pattern)
```typescript
// Source: extends existing /api/auth/send-verification pattern
// File: src/app/api/auth/change-email/route.ts

// 1. User submits new email
// 2. Generate purpose-scoped JWT: { id, oldEmail, newEmail, purpose: 'email_change' }
// 3. Send verification to NEW email
// 4. User clicks link -> /api/auth/verify-email-change?token=...
// 5. Verify JWT, check purpose === 'email_change'
// 6. Update user.email = newEmail, mark email_verified = true
// 7. Send security alert to OLD email: "Your email was changed"

const changeToken = await new SignJWT({
  id: user.id,
  old_email: user.email,
  new_email: newEmail,
  purpose: 'email_change',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('24h')
  .sign(getSecret());
```

### Share Video to Chat (extends shared_post pattern)
```typescript
// Source: extends existing Message model shared_post_id pattern
// The Message model already has type: 'shared_post' and shared_post_id
// Add shared_video_id as a new nullable FK column

// Migration: add shared_video_id to messages table
// Message type enum: add 'shared_video' to the ENUM
// Association: Message.belongsTo(Video, { foreignKey: 'shared_video_id', as: 'sharedVideo' })
```

### Activity Streak Tracking
```typescript
// Source: new model, simple daily flag
// File: src/lib/db/models/ActivityStreak.ts

export interface ActivityStreakAttributes {
  id: number;
  user_id: number;
  activity_date: string;      // DATEONLY: '2026-02-13'
  activities: string;         // JSON array of activity types performed that day
  created_at: Date;
  updated_at: Date;
}

// Qualifying activities (from CONTEXT):
// - 'daily_view': Viewing the daily post
// - 'audio_listen': Listening to full audio chapter (from ListenLog.completed)
// - 'video_watch': Watching majority of LumaShort video
// - 'social_activity': Reacting, commenting, posting to prayer wall or social feed

// Streak calculation: Count consecutive days backwards from today
// where ActivityStreak record exists for that user+date.
// Runs as cron job nightly OR calculated on-demand for stats page.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js middleware.ts for auth | proxy.ts (Next.js 16 rename) | Next.js 16 (2025-2026) | middleware.ts still works but deprecated; proxy.ts should NOT contain DB queries; keep auth in withAuth HOF |
| OpenAI Whisper v1 only | GPT-4o Transcribe available ($0.006/min) | Late 2025 | Both work; Whisper-1 is sufficient for basic caption generation |
| Manual video transcoding | Single-file serving | Decision | No transcoding needed per CONTEXT; serve single MP4 as-is |
| Complex video player libraries | Native HTML5 `<video>` | Ongoing | For simple playback (no adaptive streaming), native element is sufficient |

**Deprecated/outdated:**
- Next.js `middleware.ts`: Renamed to `proxy.ts` in Next.js 16. Still functional but should not be used for new features. The project does not currently use middleware.ts, so this is not a concern.
- Sequelize v7: Available but project is on v6. No need to upgrade for Phase 4.

## Open Questions

1. **FFmpeg on XAMPP/macOS development environment**
   - What we know: `ffmpeg-static` bundles a binary for macOS, Linux, Windows
   - What's unclear: Whether XAMPP's environment interferes with binary execution
   - Recommendation: Test `ffmpeg-static` import early in development. If issues arise, fallback to system-installed ffmpeg (brew install ffmpeg on macOS)

2. **OpenAI API Key availability**
   - What we know: Caption generation requires an OpenAI API key in .env.local
   - What's unclear: Whether the project has an OpenAI account set up
   - Recommendation: Make caption generation optional (null client pattern like B2). If OPENAI_API_KEY is not set, skip auto-captioning and allow admin to manually upload VTT files later

3. **Ban enforcement approach**
   - What we know: Need to block banned users from all actions
   - What's unclear: Exact performance characteristics of adding a DB check to withAuth
   - Recommendation: Start with simple DB check in withAuth (User.findByPk is fast on indexed PK). If performance is an issue, add in-memory cache. The simple approach is almost certainly fine for the expected user scale.

4. **Permanent deletion data cleanup scope**
   - What we know: After 30 days, user data should be permanently deleted and content anonymized
   - What's unclear: Full cascade of related records (posts, comments, reactions, messages, etc.)
   - Recommendation: User model already has `paranoid: true`. Use `destroy({ force: true })` for hard delete. Posts should NOT be force-deleted; instead update `user_id` to a special "Deleted User" account (id=0 or a sentinel). This preserves conversation threads and prayer wall integrity.

5. **Hero banner video selection**
   - What we know: Auto-play hero at top of library, muted
   - What's unclear: Whether admin manually selects hero or it's automatic (most recent/popular)
   - Recommendation: Add `is_hero` boolean to Video model. Admin toggles this flag. Only one video should be hero at a time (enforce in API). Hero plays muted with loop, shows title overlay.

## Sources

### Primary (HIGH confidence)
- **Existing codebase analysis** - Direct examination of 30+ source files including models, API routes, middleware, storage, notifications, email templates, and UI components
- **Sequelize v6 paranoid documentation** - https://sequelize.org/docs/v6/core-concepts/paranoid/ - Verified soft delete, restore, and force delete behavior
- **Backblaze B2 streaming blog** - https://www.backblaze.com/blog/roll-camera-streaming-media-from-backblaze-b2/ - Confirmed byte-range request support

### Secondary (MEDIUM confidence)
- **OpenAI Whisper API pricing** - https://platform.openai.com/docs/pricing - $0.006/min, WebVTT output supported
- **fluent-ffmpeg + ffmpeg-static** - npm packages - Standard approach for Node.js video processing, confirmed by multiple blog posts and npm download counts
- **Next.js 16 proxy.ts migration** - https://nextjs.org/docs/app/guides/upgrading/version-16 - middleware.ts renamed to proxy.ts

### Tertiary (LOW confidence)
- **In-memory ban cache approach** - Based on common patterns, not verified with official documentation for this specific stack. Simple Map with TTL is well-understood but should be validated during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already installed and in use; only 3 new dependencies needed (fluent-ffmpeg, ffmpeg-static, openai)
- Architecture: HIGH - Every pattern extends existing codebase conventions (ListenLog for progress, PostReaction for video reactions, withAdmin for moderation, presigned URL for uploads, purpose-scoped JWT for email change)
- Pitfalls: HIGH - Identified from codebase analysis and real-world patterns; CORS, ENUM migration, timezone, and FFmpeg binary issues are well-documented
- Video processing: MEDIUM - ffmpeg thumbnail extraction and Whisper API are well-documented but not yet proven in this specific XAMPP/macOS environment

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (30 days - stable domain, established libraries)
