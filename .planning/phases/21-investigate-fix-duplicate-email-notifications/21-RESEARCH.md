# Phase 21: Investigate & Fix Duplicate Email Notifications - Research

**Researched:** 2026-03-16
**Domain:** Email notification deduplication, node-cron scheduling, Node.js clustering
**Confidence:** HIGH

## Summary

This research investigates all paths through which duplicate email notifications can be sent to users in the FreeLuma platform. The system uses SendGrid for delivery, node-cron for scheduled batch processing, and a custom `createNotification()` function for immediate dispatch. The platform runs a clustered Node.js setup (1 primary + 8 workers in production via `server.js`) with cron jobs initialized on only worker #1 via `/api/cron-init`.

After thorough analysis of the codebase, I identified **6 concrete duplicate email vectors** and **2 lower-risk vectors** spanning the daily reminder system, batched email processors, immediate email dispatchers, and the interaction between clustering and cron initialization. The most impactful issue is the `both`-mode daily reminder logic, which intentionally sends 2 emails per user (Bible + Positivity) but the dedup guard (`sentToday` set) blocks the second email after the first one is logged, causing inconsistent behavior rather than true duplicates. However, the more dangerous issue is the race condition in the dedup check itself: the `sentToday` set is built ONCE at the start of `processDailyReminders()` but subsequent `sendNotificationEmail()` calls create new EmailLog rows mid-loop, so two overlapping cron executions could both pass the dedup check.

**Primary recommendation:** Add database-level dedup constraints, fix the `both`-mode daily reminder dedup logic, add cron execution locking to prevent overlapping runs, and verify the `/api/cron-init` endpoint cannot be hit by multiple workers.

## Standard Stack

The existing stack is established and does not need changing. This phase is a bug-fix investigation, not a greenfield build.

### Core (Already in Use)
| Library | Purpose | Relevant Files |
|---------|---------|----------------|
| @sendgrid/mail | Email delivery via SendGrid API | `src/lib/email/index.ts` |
| node-cron | Cron job scheduling | `src/lib/email/scheduler.ts` |
| sequelize | ORM for EmailLog, Notification, UserSetting models | `src/lib/db/models/` |
| jose | JWT generation for unsubscribe URLs | `src/lib/email/queue.ts` |
| uuid | Tracking ID generation | `src/lib/email/tracking.ts` |

### Supporting (May Be Needed for Fixes)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| sequelize (transactions) | Atomic dedup checks | If DB-level locking is needed for dedup |
| No new libraries needed | This is a fix phase | All tools exist in current stack |

## Architecture Patterns

### Current Email Notification Architecture
```
server.js (cluster primary)
  |
  +-- worker #1 -> /api/cron-init -> initEmailScheduler()
  |     |                              |
  |     |                              +-- cron */5  -> processDMEmailBatch()
  |     |                              +-- cron */5  -> processVideoBroadcast()
  |     |                              +-- cron */15 -> processReactionCommentBatch()
  |     |                              +-- cron 0 *  -> processDailyReminders()
  |     |                              +-- cron 0 3  -> cleanupOldNotifications()
  |     |
  |     +-- API routes -> createNotification()
  |           |              |
  |           |              +-- processFollowRequestEmail()  (immediate)
  |           |              +-- processPrayerResponseEmail()  (immediate)
  |           |              +-- processWorkshopEmail()        (immediate)
  |           |              +-- dispatchSMSNotification()     (immediate)
  |           |
  +-- workers 2-8 -> API routes -> createNotification() (same immediate dispatches)
```

### Dedup Mechanisms Currently in Place
| Email Type | Dedup Mechanism | Effectiveness |
|------------|----------------|---------------|
| `daily_reminder` | `sentToday` Set built from EmailLog at start of batch | FLAWED (see Pitfall 1) |
| `dm_batch` | EmailLog.count for recipient in last 24h | EFFECTIVE but has race window |
| `reaction_comment_batch` | EmailLog.count for recipient in last 24h | EFFECTIVE but has race window |
| `new_video` | EmailLog.count by subject + existing cursor check | EFFECTIVE |
| `follow_request` | None (immediate, one-shot) | RELIES ON API-level idempotency |
| `prayer_response` | None (immediate, one-shot) | RELIES ON API-level idempotency |
| `workshop_*` | None (immediate) / group_key for reminders | PARTIAL |
| All types | Rate limit: 5 emails/user/hour | SAFETY NET, not dedup |
| All types | Quiet hours check | NOT dedup, time-based suppression |

### Cron Initialization Guard Chain
1. `server.js`: Only `cluster.worker?.id === 1` calls `/api/cron-init`
2. `/api/cron-init`: `globalThis.__cronSchedulersStarted` guard
3. `scheduler.ts`: `initialized || globalThis.__emailSchedulerReady` guard
4. `reminders.ts`: `initialized || globalThis.__workshopCronsReady` guard

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron execution locking | Custom file-based locks | Database advisory lock or `SET` flag with timestamp | DB locks work across restarts, file locks don't |
| Dedup for immediate emails | In-memory sets | EmailLog INSERT with unique constraint or SELECT FOR UPDATE | Memory-based dedup doesn't survive worker restarts |
| Idempotency keys | Custom UUID-based system | Composite unique index on `(recipient_id, email_type, DATE(created_at))` for daily types | DB enforces uniqueness atomically |

## Common Pitfalls

### Pitfall 1: `both`-Mode Daily Reminder Dedup is Broken (CRITICAL)
**What goes wrong:** For users with `mode='both'`, `processDailyReminders()` loops over `['bible', 'positivity']` and sends two separate emails. However, the dedup guard `sentToday.has(user.id)` is checked BEFORE the loop. After the first email is sent (Bible), an EmailLog row is created. But `sentToday` was built at the START of the function and is never refreshed. On the NEXT cron execution (1 hour later), the `sentToday` set will contain this user, blocking ALL daily reminders even though only Bible was sent, not Positivity.

**Why it happens:** The `sentToday` set is a snapshot built once per `processDailyReminders()` call. It correctly prevents re-sending on the SAME hour cron tick, but the logic for `both`-mode users expects to send TWO emails in one loop iteration, and the dedup correctly allows this. The REAL issue is that the second cron tick (next hour) blocks the user entirely because they already have a `daily_reminder` EmailLog entry today. This means if a `both`-mode user's first email succeeds but the second fails (rate limit, quiet hours, error), they can never get the missed one retried.

**How to avoid:** Either: (a) Track dedup per `(recipient_id, email_type, mode, date)` instead of just `(recipient_id, email_type, date)`, or (b) use a single combined email for `both`-mode users containing both Bible and Positivity content.

**Warning signs:** `both`-mode users report only receiving Bible content emails but never Positivity (or vice versa).

### Pitfall 2: Race Condition in Batch Email Dedup (MEDIUM)
**What goes wrong:** The `processDMEmailBatch()` and `processReactionCommentBatch()` functions check `EmailLog.count()` for recent sends, then proceed to send. If the cron job overlaps with itself (e.g., a slow batch takes >5 minutes for DM, or >15 minutes for reaction/comment), two concurrent executions can both pass the dedup check before either writes its EmailLog row.

**Why it happens:** node-cron does NOT prevent overlapping executions. If `processDMEmailBatch()` takes longer than 5 minutes (e.g., 32K users, SendGrid latency), the next cron tick starts a second execution while the first is still running.

**How to avoid:** Add a "running" guard flag: `let dmBatchRunning = false;` at module level. Set it before execution, clear after. Or use a database-level lock (e.g., advisory lock or a `platform_settings` row with a timestamp).

**Warning signs:** Users receive duplicate DM batch or reaction/comment batch emails, especially during high-load periods.

### Pitfall 3: Presence Manager is Per-Worker (MEDIUM)
**What goes wrong:** The `presenceManager` is an in-memory singleton (`new PresenceManager()`) in `src/lib/socket/presence.ts`. In the clustered production setup (8 workers), each worker has its own `presenceManager` instance. The cron jobs run on worker #1, but a user might be connected to worker #3's Socket.IO. Worker #1's `presenceManager.isOnline(userId)` returns false even though the user IS online on another worker.

**Why it happens:** The `@socket.io/cluster-adapter` distributes Socket.IO connections across workers, but presence tracking is local to each worker's memory.

**How to avoid:** This means the "skip if online" optimization in `processDMEmailBatch()` and `processReactionCommentBatch()` may incorrectly send emails to users who are actually online (just on a different worker). This is not a "duplicate" issue but a "should not have sent" issue. For the duplicate investigation, this is lower priority but worth noting.

**Warning signs:** Users who are actively browsing the app still receive DM batch or reaction/comment batch emails.

### Pitfall 4: No Dedup for Immediate Emails (Follow, Prayer) (MEDIUM)
**What goes wrong:** `processFollowRequestEmail()` and `processPrayerResponseEmail()` are called directly from `createNotification()` with no EmailLog-based dedup check. If `createNotification()` is called twice for the same event (e.g., API retry, client double-click), two emails are sent.

**Why it happens:** These functions rely on the API route preventing duplicate `createNotification()` calls. The follow route checks for existing follows (`409 Already following`), and the prayer route has similar guards. But there's a race window: two rapid API calls can both pass the `findOne` check before either creates the record.

**How to avoid:** Add an EmailLog dedup check in `processFollowRequestEmail()` and `processPrayerResponseEmail()`: check if an email of that type was sent for the same `(recipient_id, actor_id)` in the last N minutes.

**Warning signs:** Users receive two "X started following you" or "X is praying for you" emails for a single action.

### Pitfall 5: Workshop Reminder Dedup Uses group_key but Email Does Not (LOW-MEDIUM)
**What goes wrong:** Workshop reminder cron (`sendWorkshopReminders()`) checks for existing notifications by `group_key` to prevent duplicate in-app notifications. But each notification creation calls `createNotification()` which fires `processWorkshopEmail()` for each notification. If a workshop has 50 attendees, 50 notifications are created, and 50 individual email sends are triggered. This is CORRECT behavior (each attendee gets one email). However, if the cron overlaps and the group_key check fails (unlikely given the `Notification.findOne` guard), duplicate emails could be sent to each attendee.

**How to avoid:** The group_key guard is per-workshop-per-tier (1h vs 15m), which is solid. The risk is low but verify that `Notification.findOne({ where: { group_key } })` correctly prevents re-entry.

### Pitfall 6: `/api/cron-init` Can Be Called Multiple Times on Restart (MEDIUM)
**What goes wrong:** When PM2 restarts the app (deploy, crash recovery, memory limit), worker #1 calls `/api/cron-init` after a 5-second delay. But the `globalThis.__cronSchedulersStarted` flag is per-process and resets on restart. If the previous worker's cron jobs haven't finished their current tick before being killed, the new worker starts fresh cron schedules. During the overlap window (old process dying + new process starting), both could be running cron jobs simultaneously.

**Why it happens:** PM2 `fork` mode with `restart_delay: 3000` means there's a 3-second delay between process exit and new process start. But if the old process hangs during shutdown, node-cron callbacks may still be executing when the new process starts its own cron jobs.

**How to avoid:** The existing guards (`initialized`, `globalThis.__emailSchedulerReady`) prevent double-init within a single process. The risk is specifically during deployment/restart overlap. A database-level "last execution timestamp" for each cron job would prevent overlapping runs across process boundaries.

**Warning signs:** Users receive duplicate emails right after deployments.

## Code Examples

### Fix 1: Add Execution Lock to Batch Processors
```typescript
// Source: Pattern for preventing overlapping cron executions
// Add to src/lib/email/queue.ts

let dmBatchRunning = false;
let reactionBatchRunning = false;
let dailyReminderRunning = false;

export async function processDMEmailBatch(): Promise<void> {
  if (dmBatchRunning) {
    console.log('[Email Queue] DM batch already running, skipping');
    return;
  }
  dmBatchRunning = true;
  try {
    // ... existing logic ...
  } finally {
    dmBatchRunning = false;
  }
}

// Same pattern for processReactionCommentBatch and processDailyReminders
```

### Fix 2: Fix `both`-Mode Daily Reminder Dedup
```typescript
// Source: Fix for Pitfall 1
// The sentToday set should track (userId, mode) pairs, not just userId

// Option A: Track by (userId + mode) using a composite key
const sentTodayKey = new Set(
  (alreadySent as Array<{ recipient_id: number; subject: string }>)
    .map(r => {
      // Infer mode from subject or add a mode column to email_logs
      return `${r.recipient_id}`;
    })
);

// Option B (better): Don't block both-mode users after first send
// Instead, track exact (recipient_id, email_type, date, content_mode) combinations
// This requires adding a `metadata` or `content_mode` column to email_logs

// Option C (simplest): For both-mode users, send a single combined email
// containing both Bible and Positivity content
```

### Fix 3: Add Dedup to Immediate Email Dispatchers
```typescript
// Source: Pattern for follow/prayer email dedup
// Add to processFollowRequestEmail() and processPrayerResponseEmail()

export async function processFollowRequestEmail(
  userId: number,
  actorId: number
): Promise<void> {
  const { EmailLog } = await import('@/lib/db/models');

  // Dedup: check if we sent this exact email in last 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentDup = await EmailLog.count({
    where: {
      recipient_id: userId,
      email_type: 'follow_request',
      created_at: { [Op.gte]: fiveMinAgo },
    },
  });
  if (recentDup > 0) return;

  // ... existing logic ...
}
```

### Fix 4: Database-Level Cron Execution Lock
```typescript
// Source: Pattern for cross-process cron locking via PlatformSetting
// Prevents overlapping runs during PM2 restarts

async function acquireCronLock(jobName: string, maxAgeMs: number): Promise<boolean> {
  const { PlatformSetting } = await import('@/lib/db/models');
  const key = `cron_lock_${jobName}`;
  const existing = await PlatformSetting.get(key);

  if (existing) {
    const lockTime = parseInt(existing, 10);
    if (Date.now() - lockTime < maxAgeMs) {
      return false; // Lock still held
    }
    // Lock expired, safe to acquire
  }

  await PlatformSetting.set(key, String(Date.now()));
  return true;
}

async function releaseCronLock(jobName: string): Promise<void> {
  const { PlatformSetting } = await import('@/lib/db/models');
  await PlatformSetting.destroy({
    where: { key: `cron_lock_${jobName}` }
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory dedup sets | DB-backed dedup with EmailLog | Phase 10 (original) | Good foundation but has gaps |
| Single cron instance assumption | Cluster-aware worker #1 init | Phase 10 | Mostly works, restart overlap risk |

**Key insight:** The current system was well-designed for the common case but lacks protection against edge cases: overlapping cron executions, `both`-mode interaction with dedup, immediate email retry scenarios, and cross-process coordination during restarts.

## Investigation Plan

The planner should structure this phase as an investigation-then-fix workflow:

### Step 1: Audit Production EmailLog Data
Query production `email_logs` table to identify actual duplicates:
```sql
-- Find users who received >1 daily_reminder email on the same day
SELECT recipient_id, DATE(sent_at) as send_date, COUNT(*) as cnt
FROM email_logs
WHERE email_type = 'daily_reminder' AND status IN ('sent', 'opened')
GROUP BY recipient_id, DATE(sent_at)
HAVING cnt > 1
ORDER BY cnt DESC;

-- Find users who received >1 of any email type in a short window
SELECT recipient_id, email_type,
       MIN(sent_at) as first_sent, MAX(sent_at) as last_sent,
       COUNT(*) as cnt
FROM email_logs
WHERE status IN ('sent', 'opened')
  AND sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY recipient_id, email_type, DATE(sent_at)
HAVING cnt > 1
ORDER BY cnt DESC;

-- Check both-mode users vs email counts
SELECT u.id, u.mode, COUNT(el.id) as daily_emails_today
FROM users u
LEFT JOIN email_logs el ON el.recipient_id = u.id
  AND el.email_type = 'daily_reminder'
  AND DATE(el.sent_at) = CURDATE()
WHERE u.mode = 'both'
GROUP BY u.id, u.mode;
```

### Step 2: Fix Identified Issues
Based on audit results, apply targeted fixes for the vectors identified above.

### Step 3: Add Monitoring
Add logging/metrics to track email send rates and catch future duplicates.

## Open Questions

1. **What specific duplicate reports exist?**
   - What we know: The phase description says users MAY be receiving duplicates
   - What's unclear: Which specific email types are reported as duplicated
   - Recommendation: Query production EmailLog data first to identify which vectors are actually firing, then prioritize fixes accordingly

2. **Should `both`-mode users receive 2 separate daily emails or 1 combined?**
   - What we know: Current code sends 2 (one per mode), but dedup may block the second
   - What's unclear: Product intent - are 2 daily emails desirable for `both` users?
   - Recommendation: A single combined email is better UX and avoids the dedup issue entirely

3. **Is the presence manager clustering issue actually causing "sent to online user" complaints?**
   - What we know: `presenceManager` is per-worker, so online check is unreliable in production
   - What's unclear: Whether users have actually complained about this
   - Recommendation: Fix is straightforward (remove the online check for batch emails, or use Redis-backed presence), but lower priority than actual duplicates

## Sources

### Primary (HIGH confidence)
- `src/lib/email/scheduler.ts` - Cron job initialization with globalThis guards
- `src/lib/email/queue.ts` - All batch and immediate email processors with dedup logic
- `src/lib/email/index.ts` - SendGrid integration and dev whitelist
- `src/lib/notifications/create.ts` - Central notification creation with email dispatch
- `src/lib/workshop/reminders.ts` - Workshop cron jobs with group_key dedup
- `server.js` - Cluster setup, worker #1 cron init via /api/cron-init
- `src/app/api/cron-init/route.ts` - Cron initialization endpoint with globalThis guard
- `src/lib/socket/presence.ts` - In-memory per-worker presence manager
- `src/lib/db/models/EmailLog.ts` - EmailLog model definition
- `src/lib/db/models/UserSetting.ts` - Email notification preference columns
- `ecosystem.config.cjs` - PM2 fork mode, single instance

### Secondary (MEDIUM confidence)
- `src/lib/sms/queue.ts` - SMS dispatch (parallel issue, same patterns)
- `src/lib/db/migrations/041-create-email-logs.cjs` - EmailLog table indexes
- `src/app/api/follows/[userId]/route.ts` - Follow notification creation context
- `src/app/api/post-reactions/route.ts` - Reaction notification creation context

## Metadata

**Confidence breakdown:**
- Duplicate vectors identified: HIGH - Direct code analysis, all paths traced
- `both`-mode dedup issue: HIGH - Logic confirmed by reading queue.ts line by line
- Race condition risk: HIGH - Standard node-cron behavior, no overlap protection in code
- Clustering presence issue: HIGH - presenceManager is clearly per-worker singleton
- Restart overlap risk: MEDIUM - Depends on PM2 shutdown timing, hard to reproduce locally

**Research date:** 2026-03-16
**Valid until:** Indefinite (this is codebase-specific analysis, not library version dependent)
