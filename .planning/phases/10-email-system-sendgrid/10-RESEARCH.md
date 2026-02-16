# Phase 10: Email System Setup with SendGrid - Research

**Researched:** 2026-02-16
**Domain:** Email transport swap (Nodemailer to SendGrid API) + notification expansion
**Confidence:** HIGH

## Summary

This phase replaces the existing Nodemailer SMTP transport with SendGrid's v3 Mail Send API using the official `@sendgrid/mail` SDK (v8.1.6). The codebase already has a well-structured email system with 5 transactional templates, 4 notification templates, an EmailLog tracking system, queue/scheduler with node-cron, rate limiting, quiet hours, tracking pixels, and RFC 8058 unsubscribe compliance. The transport swap is surgically clean -- only `src/lib/email/index.ts` needs its `sendEmail()` function rewritten. The larger body of work is adding 3 new email notification types (reactions/comments batch, workshop lifecycle, new videos) with corresponding templates, DB migrations, settings toggles, and scheduler integrations.

The existing architecture is sound: `sendEmail()` is the single transport function called by everything else, the queue system already handles rate limiting and quiet hours, and the template system already supports tracking pixels and unsubscribe footers. The new notification types follow identical patterns to the existing DM batch and individual notification emails.

**Primary recommendation:** Use `@sendgrid/mail` SDK v8.1.6 with a single `sgMail.send()` call replacing `transporter.sendMail()`. Disable click tracking per-message via `trackingSettings`. Add 3 new `user_settings` columns and extend the `email_logs.email_type` ENUM for the new notification categories.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sendgrid/mail` | 8.1.6 | Email transport via SendGrid v3 API | Official Twilio SDK, typed, single-purpose package from monorepo |

### Supporting (already installed)
| Library | Version | Purpose | When Used |
|---------|---------|---------|-----------|
| `node-cron` | 3.0.3 | Cron scheduler for batch emails | Already running DM batch + daily reminders |
| `jose` | 6.1.3 | Unsubscribe JWT tokens | Already used for 90-day purpose-scoped tokens |
| `uuid` | 11.1.0 | Tracking ID generation | Already used for email open tracking |
| `nodemailer` | 8.0.1 | **TO BE REMOVED** after migration | Current transport, replaced by SendGrid SDK |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@sendgrid/mail` SDK | Raw `fetch()` to SendGrid REST API | SDK handles auth headers, retries, types, error parsing. SDK is minimal (~50KB). Use SDK. |
| Per-message tracking disable | Account-level SendGrid settings | Account settings affect ALL emails. Per-message control is safer and more granular. Use per-message. |

**Installation:**
```bash
npm install @sendgrid/mail
```

**Removal (after migration verified):**
```bash
npm uninstall nodemailer @types/nodemailer
```

## Architecture Patterns

### Current Email Architecture (unchanged)
```
src/lib/email/
  index.ts         # sendEmail() — THE ONLY FILE THAT CHANGES FOR TRANSPORT SWAP
  templates.ts     # All HTML template functions (add new ones here)
  queue.ts         # Batch processing, rate limiting, quiet hours (add new processors here)
  scheduler.ts     # node-cron jobs (add new cron entries here)
  tracking.ts      # UUID tracking, markSent/markBounced/markOpened (no changes)
```

### Pattern 1: Transport Swap in `sendEmail()`
**What:** Replace Nodemailer transport with SendGrid `sgMail.send()` in the single `sendEmail()` function
**When to use:** This is the core migration -- one function change propagates to all email sends

**Current code (Nodemailer):**
```typescript
// src/lib/email/index.ts — CURRENT
import nodemailer from 'nodemailer';

const FROM_ADDRESS = process.env.SMTP_FROM || 'noreply@freeluma.com';

function getTransporter() {
  if (!isSmtpConfigured()) return null;
  return nodemailer.createTransport({ host, port, auth });
}

export async function sendEmail(to, subject, html, headers?) {
  const transporter = getTransporter();
  if (!transporter) { /* console fallback */ return; }
  await transporter.sendMail({ from: `"Free Luma" <${FROM_ADDRESS}>`, to, subject, html, headers });
}
```

**New code (SendGrid):**
```typescript
// src/lib/email/index.ts — NEW
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'hello@freeluma.com';
const FROM_NAME = 'Free Luma';

// Dev whitelist: comma-separated emails in env var
const DEV_WHITELIST = process.env.EMAIL_DEV_WHITELIST
  ? process.env.EMAIL_DEV_WHITELIST.split(',').map(e => e.trim().toLowerCase())
  : null;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>
): Promise<void> {
  if (!SENDGRID_API_KEY) {
    // Dev fallback: log to console (same as before)
    console.log('\n========== EMAIL (SendGrid not configured) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML length: ${html.length} chars`);
    console.log('=================================================\n');
    return;
  }

  // Dev whitelist guard
  if (DEV_WHITELIST && !DEV_WHITELIST.includes(to.toLowerCase())) {
    console.log(`[Email] Skipped (not in dev whitelist): ${to}`);
    return;
  }

  await sgMail.send({
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    html,
    headers,
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },  // We use our own pixel tracking
    },
  });
}
```

### Pattern 2: Batch Notification Email (reactions/comments)
**What:** 15-minute batched digest combining reactions + comments + replies for a user
**When to use:** Same pattern as existing `processDMEmailBatch()` in queue.ts

```typescript
// Follows exact same pattern as processDMEmailBatch()
export async function processReactionCommentBatch(): Promise<void> {
  // 1. Raw query: find users with unread reactions/comments in last 15-60min window
  // 2. For each user: check if online (skip), check recent email (30min dedup), check settings
  // 3. Aggregate: "3 reactions and 2 comments on your posts"
  // 4. Call sendNotificationEmail() with rate limiting + quiet hours
}
```

### Pattern 3: Workshop Event Emails (6 types)
**What:** Immediate (non-batched) emails triggered by workshop lifecycle events
**When to use:** Triggered from existing workshop API routes and cron reminders

The 6 workshop email types map to existing notification types:
| Email Event | Trigger Location | Recipients |
|-------------|-----------------|------------|
| `workshop_reminder` | `src/lib/workshop/reminders.ts` cron | All RSVPd attendees |
| `workshop_cancelled` | `src/lib/workshop/reminders.ts` no-show + `workshops/[id]/route.ts` manual cancel | All RSVPd attendees |
| `workshop_invite` | `src/app/api/workshops/[id]/invite/route.ts` | Invited user |
| `workshop_recording` | `src/app/api/workshops/recording-callback/route.ts` | All attendees who joined |
| `workshop_updated` | `src/app/api/workshops/[id]/route.ts` PATCH | All RSVPd attendees |
| `workshop_started` | `src/app/api/workshops/[id]/start/route.ts` | All RSVPd attendees |

### Pattern 4: New Video Email (broadcast)
**What:** Broadcast email to ALL users when a new video is published
**When to use:** Triggered from `src/app/api/videos/route.ts` POST and `src/app/api/videos/[id]/route.ts` PATCH on first publish

This is the only high-volume email type. For 31K users, this must be batched through the scheduler (not inline). Recommended approach:
1. When video publishes, set a flag (or create a DB row) marking "video X needs broadcast"
2. Cron job picks up pending broadcasts and sends in batches (e.g., 100 users per iteration)
3. SendGrid rate limit: 600 requests/minute = 10/second. At 31K users, takes ~52 minutes to complete.

### Pattern 5: Dev Whitelist
**What:** Environment variable with comma-separated allowed recipient emails for dev safety
**When to use:** Development mode -- prevents accidental email sends to real users

```bash
# .env.local
EMAIL_DEV_WHITELIST=admin@freeluma.com,testuser@freeluma.com,dev@yourpersonal.com
```

### Anti-Patterns to Avoid
- **Inline broadcast sending:** Do NOT send 31K emails synchronously in a video publish API handler. Use the cron scheduler.
- **SendGrid Dynamic Templates:** Decision is to keep templates in code. Do NOT migrate to SendGrid template system.
- **SendGrid click tracking:** Explicitly disable per-message. Link rewriting breaks our URLs and confuses users.
- **SendGrid open tracking:** Explicitly disable per-message. We have our own pixel-based tracking in `tracking.ts`.
- **Multiple API keys:** Decision is single key. Do NOT create separate transactional/notification keys.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email transport | Raw HTTP/fetch to SendGrid API | `@sendgrid/mail` SDK | Handles auth, retries, error parsing, types |
| SPF/DKIM/DMARC | Manual DNS record generation | SendGrid Domain Authentication UI | Auto-generates CNAME records for automated security |
| Bounce/complaint handling | Custom webhook handlers | SendGrid dashboard monitoring | Pro plan includes bounce/complaint tracking built-in |
| Email rendering/preview | Custom preview system | Send test email to self | Decision: real emails in dev with whitelist guard |

**Key insight:** The existing email architecture is already excellent. The transport swap is minimal. The real work is template creation and wiring new notification types into existing patterns.

## Common Pitfalls

### Pitfall 1: ENUM Migration for email_type
**What goes wrong:** The `email_logs.email_type` column is a MySQL ENUM. Adding new values requires an ALTER TABLE with all existing + new values listed.
**Why it happens:** MySQL ENUMs can't have values appended; the entire ENUM must be redefined.
**How to avoid:** Migration must list ALL values: `ENUM('dm_batch', 'follow_request', 'prayer_response', 'daily_reminder', 'reaction_comment_batch', 'workshop_reminder', 'workshop_cancelled', 'workshop_invite', 'workshop_recording', 'workshop_updated', 'workshop_started', 'new_video')`
**Warning signs:** Sequelize error "Data truncated for column 'email_type'" when inserting new types.

### Pitfall 2: Hardcoded Domain in Templates
**What goes wrong:** Templates currently use `process.env.NEXT_PUBLIC_APP_URL` which is `http://localhost:3000` in dev.
**Why it happens:** Decision says all email links must use `https://freeluma.com`.
**How to avoid:** Create a constant `const EMAIL_DOMAIN = 'https://freeluma.com'` used in all email URL construction. Keep `APP_URL` for dev console fallback only. The tracking pixel URL and unsubscribe URL must also use the hardcoded domain.
**Warning signs:** Email links pointing to localhost in production.

### Pitfall 3: Video Broadcast Volume
**What goes wrong:** Sending 31K emails in a single API handler blocks the request and exceeds rate limits.
**Why it happens:** `new_video` notifications currently use `createNotification()` which is in-app push only. Email adds HTTP API calls.
**How to avoid:** Use a "pending broadcast" pattern with cron-based sending. Process 50-100 users per cron tick.
**Warning signs:** 429 rate limit errors, API handler timeout.

### Pitfall 4: SendGrid Error Object Shape
**What goes wrong:** Generic `catch(err)` doesn't extract SendGrid-specific error details.
**Why it happens:** SendGrid SDK throws `ResponseError` with `error.response.body` containing `{ errors: [{ message, field, help }] }`.
**How to avoid:** Always check `error.response?.body` in catch blocks for actionable error info. Log the response body.
**Warning signs:** Opaque "Error" messages in logs with no details about what went wrong.

### Pitfall 5: Unsubscribe Category Mapping
**What goes wrong:** Adding 3 new email categories (reactions_comments, workshops, new_videos) requires updating the unsubscribe route's `CATEGORY_TO_SETTING` map.
**Why it happens:** The unsubscribe endpoint at `src/app/api/email/unsubscribe/route.ts` uses a hardcoded map.
**How to avoid:** Update both `CATEGORY_TO_SETTING` and `CATEGORY_LABELS` maps in the unsubscribe route when adding new categories.
**Warning signs:** Clicking unsubscribe link returns "Unknown Category" error page.

### Pitfall 6: FROM Address Change
**What goes wrong:** Changing from `orders@freeluma.com` (or `noreply@freeluma.com`) to `hello@freeluma.com` without verifying the sender in SendGrid dashboard.
**Why it happens:** SendGrid requires sender identity verification before sending from a new address.
**How to avoid:** Verify `hello@freeluma.com` as a sender in SendGrid dashboard BEFORE deploying code changes. Domain authentication covers this if the full domain is authenticated.
**Warning signs:** 403 Forbidden response from SendGrid API.

## Code Examples

### SendGrid Transport Function (verified from SDK docs)
```typescript
// Source: https://github.com/sendgrid/sendgrid-nodejs/blob/main/packages/mail/README.md
import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const msg: MailDataRequired = {
  to: 'recipient@example.com',
  from: { email: 'hello@freeluma.com', name: 'Free Luma' },
  subject: 'Test Subject',
  html: '<p>Hello</p>',
  headers: {
    'List-Unsubscribe': '<https://freeluma.com/api/email/unsubscribe?token=xxx&category=dm>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
  trackingSettings: {
    clickTracking: { enable: false, enableText: false },
    openTracking: { enable: false },
  },
};

try {
  await sgMail.send(msg);
} catch (error: unknown) {
  const err = error as { response?: { body?: { errors?: Array<{ message: string; field: string }> } } };
  console.error('SendGrid error:', err.response?.body?.errors);
}
```

### Dev Whitelist Guard Pattern
```typescript
// Environment: EMAIL_DEV_WHITELIST=admin@freeluma.com,dev@example.com
const DEV_WHITELIST = process.env.EMAIL_DEV_WHITELIST
  ? process.env.EMAIL_DEV_WHITELIST.split(',').map(e => e.trim().toLowerCase())
  : null;

// In sendEmail():
if (DEV_WHITELIST && !DEV_WHITELIST.includes(to.toLowerCase())) {
  console.log(`[Email] Skipped (dev whitelist): ${to}`);
  return;
}
```

### Reaction/Comment Batch Template Structure
```typescript
// Template params for combined digest
export interface ReactionCommentBatchEmailParams {
  recipientName: string;
  reactionCount: number;
  commentCount: number;
  replyCount: number;
  items: Array<{
    type: 'reaction' | 'comment' | 'reply';
    actorName: string;
    postPreview: string;  // truncated to ~60 chars
    emoji?: string;       // for reactions
  }>;
  feedUrl: string;        // https://freeluma.com/
  trackingId?: string;
  unsubscribeUrl?: string;
}

// Subject line examples:
// "3 reactions and 2 comments on your posts"
// "5 new reactions on your posts"
// "2 new comments on your posts"
```

### Workshop Email Template Structure
```typescript
// Shared params for all workshop emails
export interface WorkshopEmailParams {
  recipientName: string;
  workshopTitle: string;
  workshopUrl: string;       // https://freeluma.com/workshops/{id}
  hostName: string;
  scheduledAt: string;       // formatted date/time
  trackingId?: string;
  unsubscribeUrl?: string;
}

// Type-specific extensions:
// workshop_reminder: adds timeUntil ("in 1 hour" / "in 15 minutes")
// workshop_cancelled: adds reason ("host did not start" / manual)
// workshop_invite: adds inviterName
// workshop_recording: adds recordingUrl
// workshop_updated: adds changeDescription
// workshop_started: adds joinUrl
```

### Migration: Add New UserSetting Columns
```javascript
// Sequelize migration
await queryInterface.addColumn('user_settings', 'email_reaction_comment_notifications', {
  type: Sequelize.BOOLEAN,
  allowNull: false,
  defaultValue: true,
  after: 'email_prayer_notifications',
});
await queryInterface.addColumn('user_settings', 'email_workshop_notifications', {
  type: Sequelize.BOOLEAN,
  allowNull: false,
  defaultValue: true,
  after: 'email_reaction_comment_notifications',
});
await queryInterface.addColumn('user_settings', 'email_new_video_notifications', {
  type: Sequelize.BOOLEAN,
  allowNull: false,
  defaultValue: true,
  after: 'email_workshop_notifications',
});
```

### Migration: Extend email_logs.email_type ENUM
```javascript
// Must list ALL existing + new values
await queryInterface.changeColumn('email_logs', 'email_type', {
  type: Sequelize.ENUM(
    'dm_batch', 'follow_request', 'prayer_response', 'daily_reminder',
    'reaction_comment_batch', 'workshop_reminder', 'workshop_cancelled',
    'workshop_invite', 'workshop_recording', 'workshop_updated',
    'workshop_started', 'new_video'
  ),
  allowNull: false,
});
```

### Error Handling with Retry
```typescript
// Recommended: simple retry with exponential backoff for transient failures
async function sendWithRetry(msg: MailDataRequired, maxRetries = 2): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await sgMail.send(msg);
      return;
    } catch (error: unknown) {
      const err = error as { code?: number; response?: { statusCode?: number; body?: unknown } };
      const statusCode = err.response?.statusCode;

      // Don't retry client errors (400, 401, 403) — only 429 and 5xx
      if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}
```

## Database Changes Required

### New Columns: `user_settings` table
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `email_reaction_comment_notifications` | BOOLEAN NOT NULL | `true` | Toggle for reaction/comment batch emails |
| `email_workshop_notifications` | BOOLEAN NOT NULL | `true` | Toggle for workshop lifecycle emails |
| `email_new_video_notifications` | BOOLEAN NOT NULL | `true` | Toggle for new video broadcast emails |

### Modified ENUM: `email_logs.email_type`
Add 8 new values to existing 4:
- `reaction_comment_batch`
- `workshop_reminder`, `workshop_cancelled`, `workshop_invite`, `workshop_recording`, `workshop_updated`, `workshop_started`
- `new_video`

### Unsubscribe Route Updates
Add 3 new entries to `CATEGORY_TO_SETTING` and `CATEGORY_LABELS` maps:
```typescript
const CATEGORY_TO_SETTING: Record<string, string> = {
  // existing...
  dm: 'email_dm_notifications',
  follow: 'email_follow_notifications',
  prayer: 'email_prayer_notifications',
  daily_reminder: 'email_daily_reminder',
  // new
  reactions_comments: 'email_reaction_comment_notifications',
  workshops: 'email_workshop_notifications',
  new_videos: 'email_new_video_notifications',
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nodemailer SMTP transport | SendGrid v3 API via `@sendgrid/mail` SDK | This phase | Removes SMTP dependency, adds API-level control |
| `noreply@freeluma.com` / `orders@freeluma.com` | `hello@freeluma.com` | This phase | Friendlier sender, consistent across all types |
| `NEXT_PUBLIC_APP_URL` in email links | Hardcoded `https://freeluma.com` | This phase | Prevents dev URLs leaking into production emails |
| 4 notification email types | 12 notification email types | This phase | Full notification coverage |

**Deprecated/outdated after this phase:**
- `nodemailer` package: Remove from dependencies
- `@types/nodemailer`: Remove from devDependencies
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` env vars: Replace with `SENDGRID_API_KEY`
- `EMAIL_FROM` env var: Replaced by hardcoded `hello@freeluma.com`

## Environment Variables

### New
| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `SENDGRID_API_KEY` | Yes (prod) | `SG.xxxxx` | SendGrid v3 API authentication |
| `EMAIL_DEV_WHITELIST` | No (dev only) | `admin@freeluma.com,dev@test.com` | Comma-separated allowed recipients in dev |

### Removed
| Variable | Replaced By |
|----------|-------------|
| `SMTP_HOST` | `SENDGRID_API_KEY` |
| `SMTP_PORT` | (not needed) |
| `SMTP_USER` | (not needed) |
| `SMTP_PASS` | (not needed) |
| `SMTP_FROM` | Hardcoded `hello@freeluma.com` |
| `EMAIL_FROM` | Hardcoded `hello@freeluma.com` |

## Scheduler Integration

### Current Cron Jobs (in `scheduler.ts`)
| Schedule | Job | Status |
|----------|-----|--------|
| `*/5 * * * *` | `processDMEmailBatch()` | Existing |
| `0 * * * *` | `processDailyReminders()` | Existing |
| `0 3 * * *` | `cleanupOldNotifications()` | Existing |

### New Cron Jobs to Add
| Schedule | Job | Purpose |
|----------|-----|---------|
| `*/15 * * * *` | `processReactionCommentBatch()` | Batched reaction/comment digest (every 15 min) |
| `*/5 * * * *` | `processVideoBroadcast()` | Process pending new-video email broadcasts (chunked) |

### Workshop Emails: No Cron Needed
Workshop emails (except reminder) are triggered inline from API routes, same pattern as `processFollowRequestEmail()` and `processPrayerResponseEmail()` -- immediate, not batched. Workshop reminders already have a cron in `src/lib/workshop/reminders.ts` that can be extended to send emails alongside push notifications.

## Open Questions

1. **Video broadcast chunking strategy**
   - What we know: 31K users, 600 req/min rate limit, need to batch
   - What's unclear: Best chunk size per cron tick, how to track "already sent to user X for video Y"
   - Recommendation: Create `video_email_broadcasts` table or use EmailLog queries to track. Process 50 users per cron tick (every 5 min = 600 users/hour = ~52 hours for full 31K... too slow). Alternative: process 500/tick = ~5 hours. Need to decide batch size vs. rate limit headroom.

2. **Workshop reminder email timing**
   - What we know: Push notification reminders fire at 1h and 15min before
   - What's unclear: Should email reminders fire at the same times, or earlier (e.g., 24h + 1h)?
   - Recommendation: Use same 1h window for email (15min is too close for email). Consider adding a 24h email reminder.

## Sources

### Primary (HIGH confidence)
- [SendGrid Node.js SDK GitHub](https://github.com/sendgrid/sendgrid-nodejs) - v8.1.6, TypeScript types, custom headers
- [SendGrid helpers TypeScript definitions](https://github.com/sendgrid/sendgrid-nodejs/blob/main/packages/helpers/classes/mail.d.ts) - MailDataRequired, TrackingSettings interfaces
- [SendGrid custom headers docs](https://github.com/sendgrid/sendgrid-nodejs/blob/main/docs/use-cases/custom-headers.md) - headers property usage
- Codebase analysis: `src/lib/email/` (all 5 files), `src/lib/db/models/EmailLog.ts`, `src/lib/db/models/UserSetting.ts`, `src/lib/workshop/reminders.ts`, `src/lib/notifications/types.ts`

### Secondary (MEDIUM confidence)
- [SendGrid rate limits](https://www.twilio.com/docs/sendgrid/api-reference/how-to-use-the-sendgrid-v3-api/rate-limits) - 600 req/min default
- [SendGrid domain authentication](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/how-to-set-up-domain-authentication) - CNAME-based DKIM/SPF
- [SendGrid tracking settings](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/tracking) - per-message click/open tracking disable
- [SendGrid tracking issue #744](https://github.com/sendgrid/sendgrid-nodejs/issues/744) - trackingSettings object structure confirmed

### Tertiary (LOW confidence)
- SendGrid Pro plan specific rate limits (could not access detailed plan documentation; 600 req/min is the general documented limit)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK, verified types, version confirmed via npm/GitHub
- Architecture: HIGH - Based on deep analysis of existing codebase patterns, direct code reading
- Pitfalls: HIGH - Derived from actual codebase structure (ENUM columns, hardcoded maps, volume math)
- New templates: MEDIUM - Template content is Claude's discretion, patterns follow existing code exactly
- Rate limit numbers: MEDIUM - 600 req/min documented, but plan-specific limits may differ

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, SDK version unlikely to change significantly)
