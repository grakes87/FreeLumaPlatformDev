---
phase: 21-investigate-fix-duplicate-email-notifications
verified: 2026-03-16T18:07:08Z
status: passed
score: 7/7 must-haves verified
gaps: []
human_verification:
  - test: "Send two daily reminder emails to a both-mode user and confirm they each carry distinct content_mode values in email_logs"
    expected: "Two email_logs rows for the same user on the same day: one with content_mode='bible', one with content_mode='positivity'"
    why_human: "Requires a live SendGrid send or production DB inspection to confirm the content_mode is actually persisted correctly at runtime"
  - test: "Deploy and restart PM2 mid-cron-run, then inspect platform_settings for stale cron_lock_* keys"
    expected: "Stale locks expire automatically (key older than maxAgeMs) and new process can acquire the lock without manual intervention"
    why_human: "Restart-overlap scenario cannot be verified via static code analysis; requires live PM2 manipulation"
---

# Phase 21: Investigate & Fix Duplicate Email Notifications Verification Report

**Phase Goal:** Eliminate all duplicate email notification vectors identified in research: fix both-mode daily reminder dedup, add immediate email dedup for follow/prayer, add module-level execution lock guards on batch processors, and add database-level cron locking via PlatformSetting for cross-process safety during PM2 restarts.
**Verified:** 2026-03-16T18:07:08Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Batch email processors cannot run concurrently (overlapping cron ticks are blocked) | VERIFIED | `dmBatchRunning`, `reactionBatchRunning`, `dailyReminderRunning`, `videoBroadcastRunning` declared at module level (queue.ts:164-167); each processor checks and sets flag with try/finally (queue.ts:180-301, 314-456, 467-643, 941-1076) |
| 2 | EmailLog table has content_mode column for distinguishing bible vs positivity daily reminders | VERIFIED | Migration 126 adds nullable `ENUM('bible','positivity')` column (migration:7-12); EmailLog.ts interface, class declaration, and init() all include `content_mode` with `allowNull: true, defaultValue: null` (EmailLog.ts:8, 33, 62-66) |
| 3 | EmailLog table has composite index for efficient dedup lookups by (recipient_id, email_type, date) | VERIFIED | Migration 126 adds `idx_email_log_recipient_type_date` on `['recipient_id', 'email_type', 'created_at']` (migration:15-17) |
| 4 | Both-mode users receive exactly 2 daily reminder emails (one Bible, one Positivity) without the second being blocked by dedup | VERIFIED | `sentToday` is a `Set<string>` keyed by `"userId:contentMode"` (queue.ts:527-530); dedup check uses `"${user.id}:${notifyMode}"` inside the per-mode loop (queue.ts:583-584); old `sentToday.has(user.id)` check confirmed removed |
| 5 | Both-mode dedup tracks by (recipient_id, email_type, content_mode, date) so Bible and Positivity emails are independently deduplicated | VERIFIED | `alreadySent` query selects both `recipient_id` and `content_mode` (queue.ts:519-526); composite key `userId:content_mode` means `userId:bible` and `userId:positivity` are independent; old `content_mode=NULL` rows map to `userId:default` so they cannot block new sends |
| 6 | Follow request and prayer response immediate emails have dedup checks preventing duplicate sends within 5 minutes | VERIFIED | `processFollowRequestEmail` checks `EmailLog.count` for `(recipient_id, email_type='follow_request', created_at>=5minAgo)` before proceeding (queue.ts:653-663); identical pattern in `processPrayerResponseEmail` (queue.ts:723-733) |
| 7 | Cron jobs use database-level locking via PlatformSetting to prevent overlapping runs across PM2 restarts | VERIFIED | `cronLock.ts` exports `acquireCronLock`/`releaseCronLock` using `PlatformSetting.get/set/destroy` with epoch timestamp and configurable maxAge (cronLock.ts:11-33); scheduler.ts wraps all 5 email cron jobs with acquire/release pairs (scheduler.ts:26-106); reminders.ts wraps all 3 workshop cron jobs (reminders.ts:34-82); original `initialized`/`globalThis` guards preserved in both files |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/migrations/126-add-content-mode-to-email-logs.cjs` | DB migration adding content_mode column and composite dedup index | VERIFIED | 25 lines; addColumn for `content_mode ENUM('bible','positivity') nullable`, addIndex for `idx_email_log_recipient_type_date`; down migration removes index then column |
| `src/lib/db/models/EmailLog.ts` | Updated model with content_mode field | VERIFIED | 99 lines; `content_mode: 'bible' \| 'positivity' \| null` in interface (line 8), Optional list (line 20), class declaration (line 33), and `init()` DataTypes.ENUM definition (lines 62-66) |
| `src/lib/email/queue.ts` | Module-level execution lock guards on all batch processors; both-mode dedup; immediate email dedup; contentMode plumbing | VERIFIED | 1091 lines; 4 lock guard variables at lines 164-167; all 4 batch processors wrapped with try/finally (processDMEmailBatch, processReactionCommentBatch, processDailyReminders, processVideoBroadcast); sentToday uses composite key; processFollowRequestEmail and processPrayerResponseEmail have 5-minute dedup windows; sendNotificationEmail accepts `contentMode` param (line 127) and persists to EmailLog (line 146) |
| `src/lib/email/cronLock.ts` | Database-level cron execution locking functions | VERIFIED | 33 lines; exports `acquireCronLock(jobName, maxAgeMs)` and `releaseCronLock(jobName)` using `PlatformSetting.get/set/destroy`; stale lock expiry via epoch timestamp comparison |
| `src/lib/email/scheduler.ts` | Cron jobs wrapped with DB-level locks | VERIFIED | 127 lines; all 5 cron jobs (dm_batch, video_broadcast, reaction_comment_batch, daily_reminders, cleanup) acquire and release DB lock via dynamic import of cronLock; original `initialized` and `globalThis.__emailSchedulerReady` guards preserved |
| `src/lib/workshop/reminders.ts` | Workshop cron jobs wrapped with DB-level locks | VERIFIED | 421 lines; all 3 workshop cron jobs (workshop_reminders, workshop_noshow, workshop_series_gen) acquire and release DB lock via dynamic import of `@/lib/email/cronLock`; original `initialized` and `globalThis.__workshopCronsReady` guards preserved |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `migration 126` | `EmailLog.ts` | `content_mode` column matches model attribute | VERIFIED | Migration adds `ENUM('bible','positivity') allowNull:true`; model has `DataTypes.ENUM('bible','positivity') allowNull:true defaultValue:null` |
| `queue.ts processDailyReminders` | `sendNotificationEmail` | `contentMode: notifyMode` passed in call | VERIFIED | Line 620: `contentMode: notifyMode` is passed inside the per-mode loop; persisted to EmailLog at line 146 |
| `queue.ts sentToday` | `EmailLog (alreadySent query)` | sentToday tracks content_mode for both-mode dedup | VERIFIED | `alreadySent` selects `['recipient_id', 'content_mode']` (line 520); sentToday Set uses `r.content_mode \|\| 'default'` composite key (line 529) |
| `queue.ts processFollowRequestEmail` | `EmailLog.count` | 5-minute sliding window dedup for follow emails | VERIFIED | `EmailLog.count({ where: { recipient_id, email_type:'follow_request', created_at: {gte: fiveMinAgo} } })` at lines 656-663 |
| `scheduler.ts` | `cronLock.ts` | Each cron job acquires DB lock before executing | VERIFIED | All 5 cron callbacks dynamically import `./cronLock` and call `acquireCronLock` before dispatching to the batch function, with `releaseCronLock` in finally |
| `reminders.ts` | `cronLock.ts` | Each workshop cron acquires DB lock before executing | VERIFIED | All 3 workshop cron callbacks dynamically import `@/lib/email/cronLock` and call `acquireCronLock` with `releaseCronLock` in finally |

---

### Requirements Coverage

This is a bug fix phase with no formal requirements. All 6 duplicate email vectors identified in the research were addressed:

| Vector (from RESEARCH.md) | Fix Applied | Status |
|---------------------------|-------------|--------|
| Pitfall 1: both-mode sentToday blocks second email | Composite `userId:contentMode` key in sentToday Set | FIXED |
| Pitfall 2: Overlapping cron batch executions (module-level) | Module-level boolean lock guards on all 4 batch processors | FIXED |
| Pitfall 4: No dedup for immediate follow/prayer emails | 5-minute EmailLog.count window in processFollowRequestEmail and processPrayerResponseEmail | FIXED |
| Pitfall 6: Cross-process restart overlap for cron jobs | DB-level PlatformSetting lock in cronLock.ts, applied to all 8 cron jobs | FIXED |
| content_mode missing from EmailLog | Migration 126 + model update | FIXED |
| contentMode not persisted to EmailLog | sendNotificationEmail accepts + persists contentMode | FIXED |

---

### Anti-Patterns Found

None. No TODOs, FIXMEs, placeholder content, or empty handler stubs found in any of the 6 files modified by this phase.

---

### Human Verification Required

#### 1. Both-Mode Email content_mode Persistence

**Test:** Create or find a user with `mode='both'` and `email_daily_reminder=true`. Wait for (or manually trigger) `processDailyReminders()`. Inspect the resulting `email_logs` rows for that user.
**Expected:** Two rows for the same day — one with `content_mode='bible'` and one with `content_mode='positivity'`. The `sentToday` set for the next cron tick should contain both `userId:bible` and `userId:positivity`, allowing neither to resend but not blocking the other mode.
**Why human:** Requires a live cron execution or manual trigger with a production-connected DB to confirm end-to-end data flow. Static code analysis confirms the code path exists but cannot verify runtime DB values.

#### 2. DB-Level Cron Lock Expiry on PM2 Restart

**Test:** With a cron job mid-execution, force-kill the process (`pm2 stop freeluma`), restart it (`pm2 start`), and observe whether the new process skips the overlapping cron tick (lock is held) and then picks up the next tick correctly (lock has expired or was released before kill).
**Expected:** If killed during execution, the lock timestamp in `platform_settings` will be within maxAgeMs, so the new process skips that tick. After maxAgeMs elapses, the next tick acquires the lock and executes normally. No duplicate sends occur.
**Why human:** PM2 restart overlap scenarios require live process manipulation. The lock logic is correct by code inspection but the timing boundary (old process still running vs. new process starting) requires runtime observation.

---

### Gaps Summary

No gaps. All 7 observable truths are verified. All 6 artifacts exist, are substantive, and are wired into the system. All key links are confirmed. No blocker anti-patterns detected.

The implementation is complete and structurally sound. Two human verification items are noted above for runtime validation, but these do not block the conclusion that the phase goal was achieved.

---

*Verified: 2026-03-16T18:07:08Z*
*Verifier: Claude (gsd-verifier)*
