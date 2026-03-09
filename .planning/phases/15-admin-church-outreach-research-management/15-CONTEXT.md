# Phase 15: Admin Church Outreach & Research Management - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Full church outreach CRM integrated into the FreeLuma admin dashboard — automated church discovery (Google Places + web scraping + AI research), pipeline management with kanban board, email campaigns with drip sequences, public sample request landing page, sample shipment logging, and conversion reporting. All 28 requirements from the standalone churchoutreach project spec consolidated into one phase. Admin-only tooling (except the public landing page).

</domain>

<decisions>
## Implementation Decisions

### Scope & Architecture
- All 28 churchoutreach requirements built in a single phase (not split across multiple)
- Integrated into existing FreeLuma admin dashboard at /admin/church-outreach
- New tables in the same freeluma_dev database (Sequelize migrations, same pattern as all prior phases)
- Not a standalone app — full integration with existing admin layout, navigation, and component patterns

### Church Discovery & Research
- Three-pronged discovery: Google Places API + web scraping + AI research
- Google Places radius-based search (e.g., "churches within 25 miles of ZIP 75001")
- Batch discovery: admin enters location + radius + optional filters, system returns up to 50-100 results
- AI research deep dive: Claude/AI analyzes each church's website and online presence to generate full profile
- Full profile generation: pastor/staff names, congregation size estimate, denomination, youth programs (AWANA/VBS/youth nights), service times, website URL, social media links, contact email/phone, and summary paragraph about church's focus areas
- Web scraping for additional data enrichment beyond Google Places
- Review-before-import: discovery results shown in staging area, admin selects which churches to import into CRM

### Pipeline & Visualization
- Simplified pipeline stages (fewer than original 7 — Claude determines optimal set: e.g., Lead, Contacted, Engaged, Converted, Repeat)
- Kanban board UI: drag-and-drop columns for each stage, church cards movable between stages
- All stage changes logged with timestamps in church activity history

### Email Campaigns
- Separate sender identity for outreach emails (e.g., outreach@freelumabracelets.com) — isolated from FreeLuma platform transactional emails
- Uses SendGrid but with dedicated sender domain/identity and separate suppression list
- Pre-built 5-7 ministry-tone email templates shipped as defaults
- Custom template editor: admin can create/edit templates with rich text and merge fields ({PastorName}, {ChurchName}, {City}, {Denomination})
- Bulk email to filtered segments: admin filters by stage/state/denomination, previews list, sends template to all matching
- Email queue processes in background (same cron pattern as existing email infrastructure)
- CAN-SPAM compliance: unsubscribe links + physical mailing address in every outreach email

### Drip Sequences
- Fully configurable: admin creates sequences with N steps
- Each step: pick template + set delay (days after previous step or trigger event)
- Multiple sequences for different scenarios (post-sample, post-contact, etc.)
- Pause/resume per church
- Cron-driven dispatch (fire-and-forget pattern)

### Email Tracking
- Open tracking via tracking pixel
- Click tracking via link rewriting
- Engagement metrics per church and per campaign
- Helps identify warm leads for prioritized follow-up

### Landing Page
- Public page at freeluma.app/sample-request (Next.js public route, no auth required)
- Bracelet/ministry-focused branding — standalone design, not the social app aesthetic
- Hero image of bracelets, ministry-focused copy, warm/inviting tone
- Form fields: church name, pastor name, email, phone, address, how they heard about us
- Duplicate detection: church name + ZIP match before creating new record
- Auto-creates church record in CRM at "Sample Requested" stage
- Thank-you page redirect + automatic confirmation email on submission

### Sample Tracking
- Basic manual logging: ship date, tracking number, carrier (USPS/UPS/FedEx), bracelet type, shipping address
- No carrier API integration (manual entry only)
- Recording a shipment auto-advances pipeline stage and triggers configured drip sequence

### Conversion Tracking
- Admin can manually mark church as converted and record order date + estimated size
- Dashboard displays total conversions, conversion rate, and revenue pipeline estimate
- Follow-up emails include UTM-tagged links to freelumabracelets.com

### Claude's Discretion
- Exact simplified pipeline stage names and count
- Google Places API integration details and rate limiting
- Web scraping implementation approach (Puppeteer, Cheerio, etc.)
- AI research prompt design and model selection
- Kanban board implementation (drag-and-drop library choice)
- Rich text editor choice for email template editor
- Email template HTML structure
- Database schema design for all new tables
- Drip sequence cron scheduling details
- Landing page visual design within the bracelet/ministry branding direction

</decisions>

<specifics>
## Specific Ideas

- "We will be able to scan the internet or use some sort of feature to find churches, do deep dives on their organization. This should not be manual input."
- Web scraping explicitly requested alongside Google Places and AI research
- Messaging must lead with ministry value ("bless your youth group"), not sales language — per original churchoutreach spec
- Churches get bombarded with vendor pitches; personal touch and relational contact outperform mass marketing in the church world
- Target churches with active youth programs (AWANA, VBS, youth nights)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminNav.tsx`: Sidebar navigation — add new "Church Outreach" menu item with icon
- `withAdmin` middleware: Protects all admin API routes
- `sendEmail()` in `src/lib/email/index.ts`: Core email sending function (will need separate sender config)
- `Modal`, `Button`, toast notifications: All admin UI primitives available
- `UserBrowser.tsx`: Reference pattern for search + filter + card list + cursor pagination
- `AuditLog.tsx`: Reference for timestamped activity feed with search and filters
- `ModerationActionModal.tsx`: Reference for multi-step modal workflows
- Content production tab pattern: Reference for multi-tab admin pages with lazy loading

### Established Patterns
- Admin layout: flex sidebar (w-64) + main content area with p-6
- API routes: `withAdmin(handler)` → cursor pagination → `successResponse()`/`errorResponse()`
- Admin forces light theme
- Card-based and table-based list patterns both available
- Status badges with color coding (blue=info, red=danger, green=active, amber=warning)
- CSS bar charts for time-series data (no chart library)
- Skeleton loading states for async data

### Integration Points
- `AdminNav.tsx` navItems array: Add church outreach menu item
- `/src/app/(admin)/admin/`: New page directory for church-outreach
- `/src/app/api/admin/`: New API route directory for church-outreach endpoints
- `/src/app/(public)/`: Landing page route at /sample-request (public, no auth)
- Sequelize migrations: New tables for churches, activities, samples, email campaigns, drip sequences
- SendGrid: New sender identity configuration for outreach domain
- Cron infrastructure: Extend existing scheduler for drip sequence processing

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-admin-church-outreach-research-management*
*Context gathered: 2026-03-09*
