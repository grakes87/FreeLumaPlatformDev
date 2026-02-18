# Phase 13: SMS Notifications & Phone Number - Research

**Researched:** 2026-02-18
**Domain:** SMS delivery, phone number verification, notification infrastructure
**Confidence:** HIGH (Twilio is mature, well-documented; existing notification patterns are clear)

## Summary

This phase adds phone number collection, OTP verification, and per-category SMS notification delivery to the FreeLuma platform. The existing infrastructure provides a strong foundation: `createNotification()` centralized dispatch, per-category email toggles in `user_settings`, quiet hours/timezone logic in `src/lib/email/queue.ts`, and an `email_logs` table for delivery tracking -- all of which have direct SMS analogs.

The standard approach is Twilio for both OTP verification (via Twilio Verify API) and SMS delivery (via Twilio Messaging API), paired with `libphonenumber-js` for phone number parsing/validation and `react-phone-number-input` for the UI component. The `users.phone` column already exists (migration 069, VARCHAR(20)), so storage is partially ready.

**Primary recommendation:** Use Twilio as the single SMS provider for both OTP verification and notification delivery. Mirror the existing email notification pattern (per-category toggles in `user_settings`, quiet hours respect, rate limiting, delivery logging) for SMS. Use Twilio Verify for OTP (no phone number purchase needed for verification) and Twilio Messaging Service for notification delivery.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `twilio` | ^5.x | SMS delivery + OTP verification | Industry standard, handles A2P 10DLC compliance, built-in STOP handling, Verify API for OTP |
| `libphonenumber-js` | ^1.11.x | Phone number parsing, validation, E.164 formatting | Lightweight (~145KB vs 600KB+ google-libphonenumber), from same author as react-phone-number-input |
| `react-phone-number-input` | ^3.4.x | International phone number input with country selector | Built on libphonenumber-js, outputs E.164 format directly, good a11y |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@sendgrid/mail` | ^8.1.6 | Already installed | Existing email delivery -- unchanged |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Twilio | SendGrid SMS (via Twilio acquisition) | SendGrid SMS is actually Twilio under the hood; using Twilio directly gives more control and the Verify API |
| `react-phone-number-input` | `react-international-phone` | Lighter (no libphonenumber dep) but less validation accuracy; react-phone-number-input is more battle-tested |
| `libphonenumber-js` | `google-libphonenumber` | google-libphonenumber is the canonical port but 4x bundle size; overkill for server-side validation |
| Twilio Verify | Custom OTP generation + Twilio SMS | Twilio Verify handles rate limiting, code generation, expiry, global routing without buying a phone number -- don't hand-roll this |

**Installation:**
```bash
npm install twilio libphonenumber-js react-phone-number-input
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── sms/
│   │   ├── index.ts           # sendSMS(), SMS client initialization (mirrors email/index.ts)
│   │   ├── verify.ts          # sendOTP(), checkOTP() using Twilio Verify API
│   │   ├── templates.ts       # SMS message templates (concise, with deep links)
│   │   └── queue.ts           # SMS dispatch logic per notification type
│   ├── email/                 # Existing email infrastructure (unchanged)
│   ├── notifications/
│   │   └── create.ts          # Extended to dispatch SMS after email (fire-and-forget)
│   └── utils/
│       └── phone.ts           # parsePhone(), validatePhone(), formatPhone() wrappers
├── app/
│   ├── api/
│   │   ├── sms/
│   │   │   ├── verify/route.ts       # POST: send OTP, PUT: check OTP code
│   │   │   └── webhook/route.ts      # POST: Twilio inbound webhook (STOP/START/HELP)
│   │   └── settings/route.ts         # Extended with SMS toggle fields
│   ├── (app)/settings/page.tsx        # Extended with phone + SMS notification toggles
│   └── (admin)/admin/analytics/       # Extended with SMS delivery stats
└── components/
    └── settings/
        └── PhoneNumberSection.tsx     # Phone input + OTP verification UI
```

### Pattern 1: SMS Client Initialization (mirrors email pattern)
**What:** Create a Twilio client singleton with console fallback when credentials are missing (same pattern as SendGrid email).
**When to use:** All SMS operations.
**Example:**
```typescript
// src/lib/sms/index.ts
import twilio from 'twilio';

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio | null {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null;
  }
  if (!client) {
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return client;
}

export async function sendSMS(to: string, body: string): Promise<boolean> {
  const twilioClient = getClient();

  if (!twilioClient) {
    console.log('\n========== SMS (Twilio not configured) ==========');
    console.log(`To: ${to}`);
    console.log(`Body: ${body}`);
    console.log('==================================================\n');
    return false;
  }

  // Dev whitelist guard (mirrors email pattern)
  const whitelist = process.env.SMS_DEV_WHITELIST;
  if (whitelist) {
    const allowed = new Set(whitelist.split(',').map(p => p.trim()));
    if (!allowed.has(to)) {
      console.log(`[SMS] Skipped (not in whitelist): ${to}`);
      return false;
    }
  }

  const message = await twilioClient.messages.create({
    body,
    to,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  });

  return message.status !== 'failed';
}
```

### Pattern 2: OTP Verification via Twilio Verify
**What:** Use Twilio Verify API for phone number OTP -- no phone number purchase needed, built-in rate limiting and code management.
**When to use:** Phone number verification flow.
**Example:**
```typescript
// src/lib/sms/verify.ts
import twilio from 'twilio';

export async function sendOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  try {
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({
        channel: 'sms',
        to: phoneNumber, // E.164 format
      });
    return { success: verification.status === 'pending' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function checkOTP(
  phoneNumber: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  try {
    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({
        to: phoneNumber,
        code,
      });
    return { success: check.status === 'approved' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}
```

### Pattern 3: SMS Dispatch from createNotification (fire-and-forget)
**What:** After existing email dispatch in `createNotification()`, add SMS dispatch following the same fire-and-forget pattern.
**When to use:** Every notification that has an SMS-eligible category.
**Example:**
```typescript
// Addition to src/lib/notifications/create.ts (after email dispatch block)

// ---- SMS dispatch (fire-and-forget, non-fatal) ----
try {
  const { dispatchSMSNotification } = await import('@/lib/sms/queue');
  await dispatchSMSNotification(recipient_id, type, entity_type, entity_id, preview_text);
} catch (err) {
  console.error('[Notification] SMS dispatch error:', err);
}
```

### Pattern 4: Twilio Webhook for Inbound STOP/START
**What:** Next.js API route that receives Twilio inbound message webhooks, validates the Twilio signature, and syncs opt-out status to the database.
**When to use:** When user texts STOP or START to the Twilio number.
**Example:**
```typescript
// src/app/api/sms/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(req: NextRequest) {
  // Parse form-encoded body
  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));

  // Validate Twilio signature
  const signature = req.headers.get('x-twilio-signature') || '';
  const url = req.url;
  const isValid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  );

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const from = params.From;  // E.164 phone number
  const optOutType = params.OptOutType; // 'STOP' | 'START' | 'HELP' | undefined

  if (optOutType === 'STOP') {
    // Disable all SMS notifications for this phone number
    const { User, UserSetting } = await import('@/lib/db/models');
    const user = await User.findOne({ where: { phone: from }, attributes: ['id'] });
    if (user) {
      await UserSetting.update(
        { sms_notifications_enabled: false },
        { where: { user_id: user.id } }
      );
    }
  } else if (optOutType === 'START') {
    // Re-enable SMS notifications
    const { User, UserSetting } = await import('@/lib/db/models');
    const user = await User.findOne({ where: { phone: from }, attributes: ['id'] });
    if (user) {
      await UserSetting.update(
        { sms_notifications_enabled: true },
        { where: { user_id: user.id } }
      );
    }
  }

  // Return TwiML empty response (don't send auto-reply; Twilio handles STOP reply)
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
```

### Anti-Patterns to Avoid
- **Building custom OTP generation:** Twilio Verify handles code generation, expiry, rate limiting, and global delivery. Rolling your own adds security risks and maintenance burden.
- **Storing phone numbers without E.164 format:** Always normalize to E.164 (`+1XXXXXXXXXX`) before storing. The existing `users.phone` VARCHAR(20) is adequate for E.164 (max 16 chars with `+`).
- **Sending SMS without checking opt-out/quiet hours:** Reuse the existing `isInQuietHours()` logic from `email/queue.ts`. Check both the per-category SMS toggle AND the global `sms_notifications_enabled` flag.
- **Coupling SMS delivery to the request cycle:** Always use fire-and-forget pattern (same as email). SMS delivery should never block API responses.
- **Skipping Twilio request validation on webhook:** Always validate the `X-Twilio-Signature` header. Without it, anyone can POST to your webhook and manipulate opt-out status.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone number validation | Regex for phone formats | `libphonenumber-js` `parsePhoneNumber()` + `isValid()` | Country codes vary wildly (1-3 digits), local formats differ, mobile vs. landline detection needed |
| OTP code generation + delivery | Random 6-digit code + raw SMS send | Twilio Verify API | Handles rate limiting (5 attempts), code expiry (10 min default), global carrier routing, fraud detection |
| Phone input UI | `<input type="tel">` with manual formatting | `react-phone-number-input` | Country code dropdown, auto-formatting, flag icons, outputs E.164 directly |
| STOP/opt-out handling | Custom keyword parsing | Twilio Messaging Service Advanced Opt-Out | Twilio handles STOP/UNSUBSCRIBE/END/QUIT/CANCEL automatically for compliance; webhook notifies you |
| SMS delivery retry logic | setTimeout retry chain | Twilio Messaging Service | Twilio handles retries, carrier fallbacks, delivery status callbacks |

**Key insight:** SMS compliance (A2P 10DLC, TCPA, STOP keyword handling) has legal implications. Twilio's Messaging Service handles the compliance layer -- building this custom would be a significant legal and engineering risk.

## Common Pitfalls

### Pitfall 1: A2P 10DLC Registration Not Started Before Launch
**What goes wrong:** SMS messages are blocked or rate-limited because the Twilio phone number isn't registered for A2P 10DLC.
**Why it happens:** A2P 10DLC registration (required since 2025 for US-bound SMS from applications) takes 10-15 business days for campaign approval.
**How to avoid:** Start A2P 10DLC registration (Brand + Campaign) in Twilio Console as a first step, before writing any code. This is a blocking dependency for production SMS.
**Warning signs:** Messages showing as "undelivered" with error code 30034 or 30035.

### Pitfall 2: Phone Number Stored Without Country Code
**What goes wrong:** SMS delivery fails because `+1` is missing from US numbers, or international numbers can't be distinguished.
**Why it happens:** Users enter "555-123-4567" and it's stored without normalization.
**How to avoid:** Always parse with `libphonenumber-js` and store in E.164 format (`+15551234567`). The `react-phone-number-input` component outputs E.164 by default.
**Warning signs:** Phone numbers in database without `+` prefix.

### Pitfall 3: SMS Sent During Quiet Hours
**What goes wrong:** Users receive SMS at 3 AM, leading to complaints and STOP opt-outs.
**Why it happens:** SMS dispatch doesn't check the same quiet hours logic as email.
**How to avoid:** Reuse the existing `isInQuietHours()` function from `src/lib/email/queue.ts` for SMS dispatch. The function already handles timezone-aware quiet hours checking.
**Warning signs:** SMS logs showing sends between midnight and 7 AM in user's timezone.

### Pitfall 4: No Dev Safeguard for SMS (Real Messages in Dev)
**What goes wrong:** Development/testing sends real SMS to real phone numbers, costing money.
**Why it happens:** Unlike email (which has console fallback), SMS has no free preview mode.
**How to avoid:** Implement `SMS_DEV_WHITELIST` env var (mirrors `EMAIL_DEV_WHITELIST` pattern). When set, only phone numbers in the whitelist receive SMS. Console-log all others.
**Warning signs:** Twilio billing shows unexpected charges during development.

### Pitfall 5: Twilio Webhook URL Mismatch After SSL Termination
**What goes wrong:** Twilio signature validation fails because the URL used for validation doesn't match the URL Twilio sent to (e.g., http vs https after reverse proxy).
**Why it happens:** When SSL terminates at a load balancer or reverse proxy, the Next.js app sees HTTP but Twilio signed against HTTPS.
**How to avoid:** In production, reconstruct the canonical URL using `X-Forwarded-Proto` and `X-Forwarded-Host` headers rather than `req.url` directly.
**Warning signs:** All webhook requests returning 403, even though parameters are correct.

### Pitfall 6: SMS Templates Too Long (Multi-Segment Charges)
**What goes wrong:** SMS messages exceeding 160 characters are split into multiple segments, each billed separately.
**Why it happens:** Templates with full URLs and verbose text easily exceed 160 chars.
**How to avoid:** Keep SMS body under 160 characters. Use short deep links (e.g., `freeluma.com/d/123` instead of full URLs). Test template lengths during development.
**Warning signs:** Twilio billing shows more message segments than expected.

### Pitfall 7: Missing phone_verified Flag
**What goes wrong:** Unverified phone numbers receive SMS notifications, or SMS is enabled before OTP verification completes.
**Why it happens:** The `users.phone` column exists but there's no `phone_verified` boolean.
**How to avoid:** Add a `phone_verified` BOOLEAN DEFAULT FALSE column to `users`. Only allow SMS notification toggles when `phone_verified = true`. Clear `phone_verified` when phone number changes.
**Warning signs:** SMS sent to numbers that were never OTP-verified.

## Code Examples

### Phone Number Validation Utility
```typescript
// src/lib/utils/phone.ts
import { parsePhoneNumber, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js';

/**
 * Parse and validate a phone number, returning E.164 format.
 * Returns null if invalid.
 */
export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = 'US'
): string | null {
  try {
    if (!isValidPhoneNumber(raw, defaultCountry)) return null;
    const parsed = parsePhoneNumber(raw, defaultCountry);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.format('E.164'); // e.g., '+15551234567'
  } catch {
    return null;
  }
}

/**
 * Format a phone number for display (e.g., "(555) 123-4567").
 */
export function formatPhoneDisplay(e164: string): string {
  try {
    const parsed = parsePhoneNumber(e164);
    return parsed?.formatNational() || e164;
  } catch {
    return e164;
  }
}
```

### SMS Notification Dispatch (per-category check)
```typescript
// src/lib/sms/queue.ts
import { sendSMS } from './index';
import { smsTemplates } from './templates';

const SMS_CATEGORY_MAP: Record<string, string> = {
  follow: 'sms_follow_notifications',
  prayer: 'sms_prayer_notifications',
  message: 'sms_dm_notifications',
  workshop_reminder: 'sms_workshop_notifications',
  workshop_started: 'sms_workshop_notifications',
  daily_reminder: 'sms_daily_reminder',
};

export async function dispatchSMSNotification(
  recipientId: number,
  type: string,
  entityType: string,
  entityId: number,
  previewText: string | null
): Promise<void> {
  const settingColumn = SMS_CATEGORY_MAP[type];
  if (!settingColumn) return; // Not an SMS-eligible notification type

  const { User, UserSetting, SmsLog } = await import('@/lib/db/models');

  // Load user with phone + settings
  const user = await User.findByPk(recipientId, {
    attributes: ['id', 'phone', 'phone_verified'],
    raw: true,
  });

  if (!user?.phone || !user.phone_verified) return;

  // Check global SMS enabled + per-category toggle
  const settings = await UserSetting.findOne({
    where: { user_id: recipientId },
    attributes: [
      'sms_notifications_enabled',
      settingColumn,
      'quiet_hours_start',
      'quiet_hours_end',
      'reminder_timezone',
    ],
    raw: true,
  });

  if (!settings?.sms_notifications_enabled) return;
  if (!(settings as Record<string, unknown>)[settingColumn]) return;

  // Check quiet hours (reuse email logic)
  const { isInQuietHours } = await import('@/lib/email/queue');
  if (isInQuietHours(
    settings.quiet_hours_start,
    settings.quiet_hours_end,
    settings.reminder_timezone
  )) return;

  // Build SMS body from template
  const body = smsTemplates[type]?.(previewText, entityId);
  if (!body) return;

  // Log + send
  const log = await SmsLog.create({
    recipient_id: recipientId,
    sms_type: type,
    body,
    status: 'queued',
  });

  try {
    const sent = await sendSMS(user.phone, body);
    await log.update({
      status: sent ? 'sent' : 'failed',
      sent_at: sent ? new Date() : null,
    });
  } catch (err) {
    console.error(`[SMS Queue] Failed for user ${recipientId}:`, err);
    await log.update({ status: 'failed' });
  }
}
```

### SMS Templates (Concise, Under 160 Chars)
```typescript
// src/lib/sms/templates.ts
const APP_SHORT_URL = 'freeluma.com';

export const smsTemplates: Record<string, (preview: string | null, entityId: number) => string> = {
  follow: (preview) =>
    `${preview || 'Someone'} wants to follow you on Free Luma. Open the app to respond. ${APP_SHORT_URL}`,

  prayer: (preview) =>
    `Someone prayed for your request on Free Luma. You're not alone. ${APP_SHORT_URL}`,

  message: (preview) =>
    `You have a new message on Free Luma. ${APP_SHORT_URL}/chat`,

  workshop_reminder: (preview, entityId) =>
    `Reminder: Your workshop starts in 1 hour! Join now: ${APP_SHORT_URL}/workshops/${entityId}`,

  workshop_started: (preview, entityId) =>
    `Your workshop is live now! Join: ${APP_SHORT_URL}/workshops/${entityId}`,

  daily_reminder: () =>
    `Your daily inspiration is ready on Free Luma. Start your day with faith. ${APP_SHORT_URL}`,
};
```

### Phone Number Section UI Component
```typescript
// src/components/settings/PhoneNumberSection.tsx (sketch)
'use client';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useState } from 'react';

export function PhoneNumberSection({ currentPhone, phoneVerified }: {
  currentPhone: string | null;
  phoneVerified: boolean;
}) {
  const [phone, setPhone] = useState(currentPhone || '');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const handleSendOTP = async () => {
    const res = await fetch('/api/sms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (res.ok) setOtpSent(true);
  };

  const handleVerifyOTP = async () => {
    const res = await fetch('/api/sms/verify', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: otp }),
    });
    if (res.ok) {
      // Phone verified, refresh settings
    }
  };

  return (
    <div>
      <PhoneInput
        international
        defaultCountry="US"
        value={phone}
        onChange={(val) => setPhone(val || '')}
      />
      {!phoneVerified && (
        otpSent ? (
          <div>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
            <button onClick={handleVerifyOTP}>Verify</button>
          </div>
        ) : (
          <button onClick={handleSendOTP}>Send Verification Code</button>
        )
      )}
    </div>
  );
}
```

## Database Schema Changes

### New Columns on `users` Table
```sql
-- users.phone already exists (migration 069, VARCHAR(20))
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER phone;
```

### New Columns on `user_settings` Table
```sql
ALTER TABLE user_settings ADD COLUMN sms_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN sms_dm_notifications BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN sms_follow_notifications BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN sms_prayer_notifications BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN sms_daily_reminder BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN sms_workshop_notifications BOOLEAN NOT NULL DEFAULT TRUE;
```

### New Table: `sms_logs`
```sql
CREATE TABLE sms_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient_id INT NOT NULL,
  sms_type VARCHAR(50) NOT NULL,
  body VARCHAR(320) NOT NULL,      -- 2 SMS segments max
  status ENUM('queued','sent','delivered','failed') NOT NULL DEFAULT 'queued',
  twilio_sid VARCHAR(50) NULL,      -- Twilio message SID for tracking
  sent_at DATETIME NULL,
  delivered_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_id) REFERENCES users(id),
  INDEX idx_sms_logs_recipient (recipient_id),
  INDEX idx_sms_logs_status (status),
  INDEX idx_sms_logs_type (sms_type)
);
```

### Migration Numbers
- Migration 094: Add `phone_verified` to `users`
- Migration 095: Add SMS toggle columns to `user_settings`
- Migration 096: Create `sms_logs` table

## Environment Variables

```env
# Twilio credentials (required for SMS features)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Twilio Verify Service SID (for OTP verification)
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Twilio Messaging Service SID (for outbound notifications)
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Dev safeguard: only send SMS to these numbers (comma-separated, E.164)
SMS_DEV_WHITELIST=+15551234567,+15559876543
```

## Twilio Account Setup Requirements (Pre-Code)

1. **Create Twilio account** and get Account SID + Auth Token
2. **Create Verify Service** in Twilio Console (for OTP) -- note the Service SID
3. **Create Messaging Service** in Twilio Console (for notifications)
4. **Purchase a phone number** (US long code, SMS-capable) -- attach to Messaging Service
5. **Register for A2P 10DLC** (Brand + Campaign registration) -- takes 10-15 business days
6. **Configure webhook URL** for inbound messages on the Messaging Service: `https://freeluma.com/api/sms/webhook`
7. **Enable Advanced Opt-Out** on the Messaging Service for STOP/START keyword handling

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Short codes for A2P SMS | 10DLC long codes with A2P registration | 2024-2025 (mandated) | Must register Brand + Campaign before sending US SMS |
| Custom OTP generation | Twilio Verify API | 2020+ | Handles rate limiting, fraud detection, global routing -- no phone number needed for OTP |
| Per-number opt-out tracking | Messaging Service Advanced Opt-Out | 2021+ | Twilio handles STOP/START at platform level, webhook notifies app for DB sync |
| Nodemailer for email | SendGrid (already migrated) | Phase 10 | Email infra stable, SMS mirrors the same patterns |

**Deprecated/outdated:**
- **Twilio Authy:** Replaced by Twilio Verify API. Do not use the Authy SDK.
- **Per-number webhook configuration:** Use Messaging Service-level webhook instead of per-number configuration.
- **Unregistered long code SMS to US:** No longer works reliably since A2P 10DLC enforcement (2025). Must register.

## Integration Points with Existing Code

### Files to Modify
1. **`src/lib/notifications/create.ts`** -- Add SMS dispatch block after email dispatch (fire-and-forget)
2. **`src/app/api/settings/route.ts`** -- Add SMS toggle fields to schema, GET/PUT handlers
3. **`src/app/(app)/settings/page.tsx`** -- Add Phone Number section + SMS notification toggles UI
4. **`src/lib/db/models/UserSetting.ts`** -- Add SMS toggle columns to model
5. **`src/lib/db/models/User.ts`** -- Add `phone_verified` to model attributes
6. **`src/app/api/email/unsubscribe/route.ts`** -- Add SMS categories to CATEGORY_TO_SETTING map (or create separate SMS unsubscribe)
7. **`src/lib/email/queue.ts`** -- Export `isInQuietHours()` for reuse by SMS queue (currently not exported)
8. **`src/app/api/admin/analytics/route.ts`** -- Add SMS delivery stats query

### Files to Create
1. **`src/lib/sms/index.ts`** -- Twilio client + sendSMS()
2. **`src/lib/sms/verify.ts`** -- OTP send + check
3. **`src/lib/sms/templates.ts`** -- SMS message templates
4. **`src/lib/sms/queue.ts`** -- Per-category SMS dispatch
5. **`src/lib/utils/phone.ts`** -- Phone parsing/validation utilities
6. **`src/app/api/sms/verify/route.ts`** -- OTP API route
7. **`src/app/api/sms/webhook/route.ts`** -- Twilio inbound webhook
8. **`src/lib/db/models/SmsLog.ts`** -- SMS log model
9. **`src/components/settings/PhoneNumberSection.tsx`** -- Phone input + OTP UI
10. **Migrations 094, 095, 096** -- Schema changes

### Reusable Patterns from Existing Code
- **Console fallback when API key missing:** `src/lib/email/index.ts` pattern -> apply to SMS
- **Dev whitelist guard:** `EMAIL_DEV_WHITELIST` pattern -> `SMS_DEV_WHITELIST`
- **Quiet hours check:** `isInQuietHours()` in `src/lib/email/queue.ts` -> reuse for SMS
- **Rate limiting:** `isRateLimited()` in `src/lib/email/queue.ts` -> adapt for SMS (separate hourly limit)
- **Unsubscribe JWT pattern:** Purpose-scoped JWT from `src/lib/email/queue.ts` -> adapt for SMS
- **Fire-and-forget dispatch:** Email dispatch block in `createNotification()` -> mirror for SMS
- **Tracking/logging:** `email_logs` pattern -> `sms_logs`
- **ToggleRow component:** Existing settings page toggle component -> reuse for SMS toggles
- **Debounced auto-save:** Settings page pattern -> apply to SMS settings

## Open Questions

1. **Daily SMS reminder scheduling**
   - What we know: Email daily reminders use hourly cron checking user's reminder_time vs current hour in their timezone. SMS could piggyback on the same scheduler or have a separate one.
   - What's unclear: Should SMS daily reminders fire at the same time as email reminders, or at a different time?
   - Recommendation: Fire both at the same `daily_reminder_time`. Add SMS dispatch alongside email dispatch in `processDailyReminders()`. Simpler for users (one reminder time, two channels).

2. **SMS rate limiting threshold**
   - What we know: Email has MAX_EMAILS_PER_HOUR = 5. SMS is more expensive per message.
   - What's unclear: What should the SMS hourly rate limit be?
   - Recommendation: MAX_SMS_PER_HOUR = 3 (lower than email due to cost and annoyance factor).

3. **Phone number on profile visibility**
   - What we know: Success criteria says "Phone number displayed on profile (own profile only, not public)."
   - What's unclear: Should it also be visible to admins in the admin user management panel?
   - Recommendation: Visible on own profile settings only. Admin can see phone in user detail view (for support purposes). Never exposed in public API responses.

4. **Onboarding phone collection**
   - What we know: Success criteria says "during onboarding or in settings." Current onboarding has 3 steps: Profile, Interests, Follow.
   - What's unclear: Should phone be a new onboarding step or embedded in the Profile step?
   - Recommendation: Do NOT add to onboarding flow. Phone collection should be in Settings only (it's optional). Adding it to onboarding would increase drop-off rate. Nudge users to add phone number via in-app prompt after onboarding is complete.

5. **Twilio Messaging Service vs direct phone number**
   - What we know: Messaging Services provide intelligent routing, A2P compliance, and Advanced Opt-Out handling. Direct phone number sending is simpler but lacks these features.
   - Recommendation: Use Messaging Service. It's required for A2P 10DLC compliance and provides the webhook integration for STOP handling.

## Sources

### Primary (HIGH confidence)
- Twilio Verify Quickstart (Node.js): https://www.twilio.com/docs/verify/quickstarts/node-express
- Twilio Messaging Quickstart: https://www.twilio.com/docs/messaging/quickstart
- Twilio Advanced Opt-Out: https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out
- Twilio Webhook Security: https://www.twilio.com/docs/usage/webhooks/webhooks-security
- Twilio A2P 10DLC: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- Existing codebase: `src/lib/email/` (email patterns), `src/lib/notifications/create.ts` (dispatch pattern), `src/lib/db/models/UserSetting.ts` (toggle columns), `src/lib/db/migrations/069-add-phone-to-users.cjs` (phone column)

### Secondary (MEDIUM confidence)
- libphonenumber-js npm: https://www.npmjs.com/package/libphonenumber-js
- react-phone-number-input npm: https://www.npmjs.com/package/react-phone-number-input
- Twilio STOP filtering: https://help.twilio.com/articles/223134027-Twilio-support-for-opt-out-keywords-SMS-STOP-filtering-

### Tertiary (LOW confidence)
- Twilio pricing (may change): https://www.twilio.com/en-us/verify/pricing -- $0.05 per verification, ~$0.0079 per SMS
- A2P 10DLC registration timeline: 10-15 business days (reported by community, may vary)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Twilio is the dominant SMS provider, libphonenumber-js is well-established, all libraries verified via official docs
- Architecture: HIGH - Mirrors existing email notification patterns exactly; createNotification dispatch, per-category toggles, quiet hours, rate limiting, delivery logging
- Pitfalls: HIGH - A2P 10DLC compliance, quiet hours, dev safeguards, and webhook security are well-documented concerns
- Code examples: MEDIUM - Based on official Twilio docs and codebase analysis; specific implementation details will evolve during planning

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain, Twilio API is mature)
