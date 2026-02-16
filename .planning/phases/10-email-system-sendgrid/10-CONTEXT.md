# Phase 10: Email System Setup with SendGrid - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace current SMTP/Nodemailer email transport with SendGrid API for all transactional and notification emails. Add missing email notification types (reactions/comments, workshop events, new videos). Keep existing server-side HTML templates and design — this is a transport swap + notification coverage expansion, not a redesign.

</domain>

<decisions>
## Implementation Decisions

### Sender Identity & Domain
- From address: `hello@freeluma.com` for all email types
- Display name: Always "Free Luma" (no per-type variation like "Free Luma Security")
- Domain authentication: Full SPF/DKIM/DMARC DNS records on freeluma.com (user owns domain and can add records)
- Previous address was `orders@freeluma.com` — migrating away from that

### Template Strategy
- Keep server-side HTML templates in `src/lib/email/templates.ts` — just swap Nodemailer transport to SendGrid API
- Do NOT migrate to SendGrid Dynamic Templates — templates stay in version control
- Keep current teal branding and table-based HTML design as-is
- Hardcode `freeluma.com` domain for all email links and tracking pixel URLs (not dynamic NEXT_PUBLIC_APP_URL)
- Open tracking only (current pixel-based) — do NOT enable SendGrid click tracking (no link rewriting)

### New Email Notification Types
- **Reactions/comments batch email**: Batched every 15 minutes (like DM batch), combines reactions + comments + replies into one digest
- **Workshop emails**: ALL lifecycle events — reminder, cancelled, invite, recording ready, updated, started
- **New video/animation email**: Sent to ALL users (not filtered by watch history)
- **Email preference toggles**: Add individual settings toggles for reactions/comments, workshops, and new videos — all ON by default
- User_settings DB columns needed for the 3 new toggle types

### SendGrid Tier & Features
- Existing SendGrid account (active for ~1 year, IP already warmed)
- Pro plan ($89.95/mo, 100K emails/mo)
- Dedicated IP (already warmed, no warmup process needed)
- Single API key for all email types (no separation of transactional vs notification keys)

### Dev & Testing Workflow
- Real emails sent in dev via SendGrid (not console fallback, not sandbox mode)
- Dev safety: Whitelist of allowed recipient email addresses in dev mode — emails to non-whitelisted addresses silently skipped
- Verification: Send test emails to self + verify delivery status in SendGrid dashboard
- No IP warmup concerns (existing account with warmed dedicated IP)

### Claude's Discretion
- SendGrid SDK vs REST API implementation choice
- Error handling and retry strategy for SendGrid API failures
- Batch email aggregation format (how to display "3 reactions and 2 comments" in template)
- Workshop email template designs for the 6 event types
- New video email template design
- Dev whitelist implementation approach (env var vs config)
- Migration of EmailLog model to track new email types

</decisions>

<specifics>
## Specific Ideas

- Current email system is fully built: 5 transactional + 4 notification templates, queue/scheduler with node-cron, tracking pixels, unsubscribe compliance (RFC 8058), rate limiting (5/hr), quiet hours
- The `orders@freeluma.com` routes replies to a support ticket system — `hello@freeluma.com` should be configured similarly
- Reactions/comments batch should follow the same 15-minute delay + offline check pattern as the existing DM batch email
- All email links must use `https://freeluma.com/...` (hardcoded production domain), not dynamic `NEXT_PUBLIC_APP_URL`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-email-system-sendgrid*
*Context gathered: 2026-02-16*
