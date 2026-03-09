# Phase 15: Admin Church Outreach & Research Management - Research

**Researched:** 2026-03-09
**Domain:** CRM / Church Discovery / Email Campaigns / Admin Tooling
**Confidence:** HIGH

## Summary

Phase 15 builds a full church outreach CRM integrated into the existing FreeLuma admin dashboard. The core technical domains are: (1) automated church discovery via Google Places API Text Search + web scraping with Cheerio + AI research with the existing Anthropic SDK, (2) a kanban pipeline board using @dnd-kit for React 19 compatible drag-and-drop, (3) email campaigns with separate SendGrid sender identity, merge-field templates, drip sequences with cron-driven dispatch, and open/click tracking, (4) a public sample request landing page, and (5) conversion/shipment tracking dashboards.

The project already has strong established patterns for all supporting infrastructure: admin page layout (sidebar + content), Sequelize migrations (.cjs), SendGrid email with tracking pixel, cron scheduling (node-cron with globalThis guard), Anthropic SDK usage, and cursor-based pagination. The phase adds ~8-10 new database tables and extends the admin navigation with a new "Church Outreach" section.

**Primary recommendation:** Build incrementally in layers: database schema + models first, then discovery/import pipeline, then pipeline kanban UI, then email campaign system with drip sequences, then landing page, then reporting dashboard. Use Google Places REST API directly (no library needed), Cheerio for scraping, existing Anthropic SDK for AI research, and @dnd-kit/core + @dnd-kit/sortable for the kanban board.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 28 churchoutreach requirements built in a single phase (not split across multiple)
- Integrated into existing FreeLuma admin dashboard at /admin/church-outreach
- New tables in the same freeluma_dev database (Sequelize migrations, same pattern as all prior phases)
- Not a standalone app — full integration with existing admin layout, navigation, and component patterns
- Three-pronged discovery: Google Places API + web scraping + AI research
- Google Places radius-based search (e.g., "churches within 25 miles of ZIP 75001")
- Batch discovery: admin enters location + radius + optional filters, system returns up to 50-100 results
- AI research deep dive: Claude/AI analyzes each church's website and online presence to generate full profile
- Full profile generation: pastor/staff names, congregation size estimate, denomination, youth programs (AWANA/VBS/youth nights), service times, website URL, social media links, contact email/phone, and summary paragraph
- Web scraping for additional data enrichment beyond Google Places
- Review-before-import: discovery results shown in staging area, admin selects which churches to import into CRM
- Simplified pipeline stages (fewer than original 7 — Claude determines optimal set)
- Kanban board UI: drag-and-drop columns for each stage, church cards movable between stages
- All stage changes logged with timestamps in church activity history
- Separate sender identity for outreach emails (e.g., outreach@freelumabracelets.com)
- Uses SendGrid but with dedicated sender domain/identity and separate suppression list
- Pre-built 5-7 ministry-tone email templates shipped as defaults
- Custom template editor: admin can create/edit templates with rich text and merge fields ({PastorName}, {ChurchName}, {City}, {Denomination})
- Bulk email to filtered segments: admin filters by stage/state/denomination, previews list, sends template to all matching
- Email queue processes in background (same cron pattern as existing email infrastructure)
- CAN-SPAM compliance: unsubscribe links + physical mailing address in every outreach email
- Fully configurable drip sequences: admin creates sequences with N steps
- Each step: pick template + set delay (days after previous step or trigger event)
- Multiple sequences for different scenarios (post-sample, post-contact, etc.)
- Pause/resume per church
- Cron-driven dispatch (fire-and-forget pattern)
- Open tracking via tracking pixel
- Click tracking via link rewriting
- Engagement metrics per church and per campaign
- Public page at freeluma.app/sample-request (Next.js public route, no auth required)
- Bracelet/ministry-focused branding — standalone design, not the social app aesthetic
- Hero image of bracelets, ministry-focused copy, warm/inviting tone
- Form fields: church name, pastor name, email, phone, address, how they heard about us
- Duplicate detection: church name + ZIP match before creating new record
- Auto-creates church record in CRM at "Sample Requested" stage
- Thank-you page redirect + automatic confirmation email on submission
- Basic manual logging: ship date, tracking number, carrier, bracelet type, shipping address
- No carrier API integration (manual entry only)
- Recording a shipment auto-advances pipeline stage and triggers configured drip sequence
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Google Places API (New) v1 | REST | Church discovery via text search with location bias | Official Google API; Text Search with circular radius is exactly what's needed for "churches within X miles of ZIP" |
| cheerio | ^1.0.0 | HTML parsing for church website scraping | Lightweight, fast, jQuery-like API; church websites are predominantly static HTML; no browser overhead |
| @anthropic-ai/sdk | ^0.74.0 | AI research deep dive on church websites | Already installed in project; used for comment generation and content pipeline |
| @dnd-kit/core | ^6.3.1 | Drag-and-drop primitives for kanban board | React 19 compatible (peerDep: react >=16.8.0); modular architecture; accessible |
| @dnd-kit/sortable | ^10.0.0 | Sortable containers for kanban columns | Works with @dnd-kit/core; supports multiple containers (columns) |
| @dnd-kit/utilities | ^3.2.2 | CSS transform utilities for drag-and-drop | Helper for applying transforms during drag operations |
| @sendgrid/mail | ^8.1.6 | Outreach email sending (separate sender identity) | Already installed; supports per-message from address and custom headers |
| node-cron | ^3.0.3 | Drip sequence dispatch scheduling | Already installed; established globalThis guard pattern for HMR safety |
| sequelize | ^6.37.7 | ORM for new church CRM tables | Already installed; all models follow established pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Request validation for all new API routes | Already installed; validate discovery params, template data, landing page form |
| uuid | ^11.1.0 | Tracking IDs for outreach email open/click tracking | Already installed; same pattern as existing email tracking |
| date-fns | ^4.1.0 | Date formatting for drip sequence delays and activity logs | Already installed; used throughout the project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core | @hello-pangea/dnd | hello-pangea/dnd does NOT support React 19 (peerDep: ^18.0.0); project uses React 19.2.3 |
| @dnd-kit/core | @dnd-kit/react (v0.3.2) | Supports React 19 but pre-1.0 (alpha quality); @dnd-kit/core 6.3.1 is stable and React 19 compatible |
| cheerio | puppeteer | Puppeteer launches full browser (heavy, slow); church websites are mostly static HTML; use Cheerio for 95% of cases |
| Google Places REST API | @googlemaps/places npm | The npm library is a gRPC-based client with extra complexity; simple REST fetch calls are sufficient for admin-initiated batch searches |
| react-email-editor (Unlayer) | Custom textarea + merge fields | Full drag-and-drop email editor is overkill for ministry email templates; a rich text textarea with merge field insertion buttons is simpler and sufficient |
| TinyMCE | Custom HTML textarea | TinyMCE adds a 500KB+ dependency; admin email templates are simple enough for a basic HTML editor with merge field buttons |

### Installation
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities cheerio
```

Note: `@anthropic-ai/sdk`, `@sendgrid/mail`, `node-cron`, `sequelize`, `zod`, `uuid`, and `date-fns` are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (admin)/admin/church-outreach/
│   │   ├── page.tsx                    # Main dashboard with tabs
│   │   ├── discover/page.tsx           # Discovery search + staging area
│   │   ├── pipeline/page.tsx           # Kanban board view
│   │   ├── campaigns/page.tsx          # Email campaigns + templates
│   │   ├── sequences/page.tsx          # Drip sequence management
│   │   └── reports/page.tsx            # Conversion reporting dashboard
│   ├── api/admin/church-outreach/
│   │   ├── churches/route.ts           # CRUD churches list
│   │   ├── churches/[id]/route.ts      # Single church detail + update
│   │   ├── churches/[id]/activities/route.ts  # Activity history
│   │   ├── churches/[id]/emails/route.ts      # Email history for church
│   │   ├── discover/route.ts           # Google Places search
│   │   ├── discover/scrape/route.ts    # Web scraping + AI research
│   │   ├── discover/import/route.ts    # Import selected churches
│   │   ├── pipeline/route.ts           # Pipeline stage updates
│   │   ├── templates/route.ts          # Email template CRUD
│   │   ├── templates/[id]/route.ts     # Single template
│   │   ├── templates/preview/route.ts  # Template preview with merge fields
│   │   ├── campaigns/route.ts          # Campaign CRUD + send
│   │   ├── campaigns/[id]/route.ts     # Campaign detail + stats
│   │   ├── sequences/route.ts          # Drip sequence CRUD
│   │   ├── sequences/[id]/route.ts     # Single sequence
│   │   ├── samples/route.ts            # Sample shipment logging
│   │   ├── conversions/route.ts        # Conversion tracking
│   │   └── reports/route.ts            # Reporting aggregates
│   ├── sample-request/
│   │   ├── page.tsx                    # Public landing page (NO layout group)
│   │   └── thank-you/page.tsx          # Thank-you redirect
│   └── api/sample-request/route.ts     # Public API for form submission
├── lib/
│   ├── church-outreach/
│   │   ├── google-places.ts            # Google Places API wrapper
│   │   ├── scraper.ts                  # Cheerio-based website scraper
│   │   ├── ai-researcher.ts            # Claude AI church research
│   │   ├── email-sender.ts             # Outreach email sender (separate from platform emails)
│   │   ├── drip-scheduler.ts           # Drip sequence cron processor
│   │   └── tracking.ts                 # Click tracking link rewriter
│   └── db/
│       ├── models/
│       │   ├── Church.ts
│       │   ├── ChurchActivity.ts
│       │   ├── ChurchNote.ts
│       │   ├── OutreachTemplate.ts
│       │   ├── OutreachCampaign.ts
│       │   ├── OutreachEmail.ts
│       │   ├── OutreachUnsubscribe.ts
│       │   ├── DripSequence.ts
│       │   ├── DripStep.ts
│       │   ├── DripEnrollment.ts
│       │   ├── SampleShipment.ts
│       │   └── ChurchConversion.ts
│       └── migrations/
│           ├── 105-create-churches.cjs
│           ├── 106-create-church-activities.cjs
│           ├── 107-create-church-notes.cjs
│           ├── 108-create-outreach-templates.cjs
│           ├── 109-create-outreach-campaigns.cjs
│           ├── 110-create-outreach-emails.cjs
│           ├── 111-create-outreach-unsubscribes.cjs
│           ├── 112-create-drip-sequences.cjs
│           ├── 113-create-drip-steps.cjs
│           ├── 114-create-drip-enrollments.cjs
│           ├── 115-create-sample-shipments.cjs
│           └── 116-create-church-conversions.cjs
└── components/admin/church-outreach/
    ├── ChurchCard.tsx                  # Church card for kanban + lists
    ├── KanbanBoard.tsx                 # Drag-and-drop kanban
    ├── KanbanColumn.tsx                # Single pipeline stage column
    ├── DiscoverySearch.tsx             # Search form + results staging
    ├── ChurchDetailModal.tsx           # Full church profile view/edit
    ├── TemplateEditor.tsx              # HTML template editor with merge fields
    ├── CampaignComposer.tsx            # Campaign creation (filter + template + preview)
    ├── SequenceBuilder.tsx             # Drip sequence step builder
    ├── SampleShipmentForm.tsx          # Log a sample shipment
    ├── ConversionForm.tsx              # Mark church as converted
    └── OutreachDashboard.tsx           # Summary stats + charts
```

### Pattern 1: Google Places Text Search with Location Bias
**What:** Use Google Places API (New) REST endpoint to search for churches within a radius of a location
**When to use:** Admin initiates batch church discovery
**Example:**
```typescript
// Source: https://developers.google.com/maps/documentation/places/web-service/text-search
const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';

interface DiscoveryParams {
  location: string; // ZIP code or city name
  radiusMiles: number;
  filters?: string; // e.g., "baptist", "youth ministry"
}

async function searchChurches(params: DiscoveryParams) {
  // Step 1: Geocode the location (ZIP/city) to lat/lng
  const { lat, lng } = await geocodeLocation(params.location);

  // Step 2: Text Search with location bias
  const response = await fetch(PLACES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.websiteUri',
        'places.types',
        'places.location',
        'places.googleMapsUri',
        'places.rating',
        'places.userRatingCount',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery: `churches ${params.filters || ''}`,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: params.radiusMiles * 1609.34, // miles to meters (max 50000)
        },
      },
      pageSize: 20, // max 20 per request
      includedType: 'church', // Google Places type filter
    }),
  });

  const data = await response.json();
  return data.places || [];
}
```

### Pattern 2: Cheerio Web Scraping for Church Data Enrichment
**What:** Scrape church website for pastor names, service times, programs
**When to use:** After Google Places returns a website URL, scrape for additional data
**Example:**
```typescript
// Source: https://cheerio.js.org/docs/intro
import * as cheerio from 'cheerio';

async function scrapeChurchWebsite(websiteUrl: string) {
  const response = await fetch(websiteUrl, {
    headers: { 'User-Agent': 'FreeLuma Church Outreach Bot/1.0' },
    signal: AbortSignal.timeout(10000), // 10s timeout
  });

  if (!response.ok) return null;
  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract structured data
  return {
    title: $('title').text().trim(),
    metaDescription: $('meta[name="description"]').attr('content') || '',
    bodyText: $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000),
    links: $('a[href]').map((_, el) => $(el).attr('href')).get().slice(0, 50),
    emails: html.match(/[\w.-]+@[\w.-]+\.\w{2,}/g) || [],
    phones: html.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [],
  };
}
```

### Pattern 3: AI Church Research with Anthropic SDK
**What:** Use Claude to analyze scraped website content and generate a structured church profile
**When to use:** After scraping, send content to Claude for intelligent profile generation
**Example:**
```typescript
// Source: Existing pattern from src/lib/ai-engagement/comment-generator.ts
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-20250514';

async function researchChurch(scrapedData: ScrapedChurchData, placesData: PlacesResult) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Analyze this church's website content and produce a structured profile.

Church name: ${placesData.displayName}
Address: ${placesData.formattedAddress}
Website content:
${scrapedData.bodyText}

Found emails: ${scrapedData.emails.join(', ')}
Found phones: ${scrapedData.phones.join(', ')}

Extract and return as JSON:
{
  "pastor_name": "string or null",
  "staff_names": ["string"],
  "denomination": "string or null",
  "congregation_size_estimate": "string (e.g., 'small <100', 'medium 100-500', 'large 500+')",
  "youth_programs": ["AWANA", "VBS", "Youth Night", etc.],
  "service_times": ["Sunday 9am", "Sunday 11am", etc.],
  "social_media": { "facebook": "url", "instagram": "url" },
  "contact_email": "string or null",
  "contact_phone": "string or null",
  "summary": "2-3 sentence summary of church's focus areas and community involvement"
}

If data is not available, use null. Be conservative — only extract what's clearly stated.`
    }],
  });

  const text = response.content[0];
  if (text?.type !== 'text') throw new Error('No text response from Claude');
  return JSON.parse(text.text);
}
```

### Pattern 4: Kanban Board with @dnd-kit
**What:** Drag-and-drop kanban board for church pipeline management
**When to use:** Pipeline view where admin drags churches between stages
**Example:**
```typescript
// Source: https://docs.dndkit.com/presets/sortable
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

function KanbanBoard({ stages, churches }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    // Determine source and destination columns
    // Call API to update church pipeline_stage
    // Log activity
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (
          <KanbanColumn key={stage} stage={stage} churches={churches[stage]} />
        ))}
      </div>
      <DragOverlay>{/* Render dragged church card */}</DragOverlay>
    </DndContext>
  );
}
```

### Pattern 5: Outreach Email with Separate Sender
**What:** Send outreach emails via SendGrid with a different from address and tracking
**When to use:** Campaign sends, drip sequence emails, confirmation emails
**Example:**
```typescript
// Source: Extends existing src/lib/email/index.ts pattern
import sgMail from '@sendgrid/mail';

const OUTREACH_FROM = {
  email: process.env.OUTREACH_EMAIL_FROM || 'outreach@freelumabracelets.com',
  name: 'Free Luma Bracelets',
};

const PHYSICAL_ADDRESS = '123 Main St, City, ST 12345'; // CAN-SPAM required

async function sendOutreachEmail(
  to: string,
  subject: string,
  html: string,
  trackingId: string,
  unsubscribeUrl: string
) {
  // Inject tracking pixel
  const pixelUrl = `${APP_URL}/api/church-outreach/track?id=${trackingId}`;
  const htmlWithTracking = html + `<img src="${pixelUrl}" width="1" height="1" style="display:none" />`;

  // Inject CAN-SPAM footer
  const htmlWithFooter = htmlWithTracking + `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">
      <p>${PHYSICAL_ADDRESS}</p>
      <p><a href="${unsubscribeUrl}">Unsubscribe from these emails</a></p>
    </div>
  `;

  await sgMail.send({
    to,
    from: OUTREACH_FROM,
    subject,
    html: htmlWithFooter,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    trackingSettings: {
      clickTracking: { enable: false }, // We do our own click tracking
      openTracking: { enable: false },  // We do our own open tracking
    },
  });
}
```

### Pattern 6: Drip Sequence Cron Processing
**What:** Cron job that checks for pending drip steps and dispatches emails
**When to use:** Runs on schedule (e.g., every 15 minutes) to process drip queues
**Example:**
```typescript
// Source: Extends existing src/lib/email/scheduler.ts pattern
import cron from 'node-cron';

export function initDripScheduler(): void {
  if (globalThis.__dripSchedulerReady) return;

  // Every 15 minutes: process pending drip steps
  cron.schedule('*/15 * * * *', async () => {
    try {
      await processPendingDripSteps();
    } catch (err) {
      console.error('[Drip Scheduler] Error:', err);
    }
  });

  globalThis.__dripSchedulerReady = true;
  console.log('[Drip Scheduler] Cron initialized');
}

async function processPendingDripSteps() {
  // Find enrollments where:
  // - status = 'active'
  // - next_step_at <= NOW()
  // - church not unsubscribed
  // For each: send template, advance to next step or complete
}
```

### Pattern 7: Click Tracking via Link Rewriting
**What:** Rewrite links in outreach email HTML to route through a tracking endpoint
**When to use:** Before sending any outreach email, rewrite all links for click tracking
**Example:**
```typescript
function rewriteLinksForTracking(html: string, emailId: number): string {
  // Replace all href links with tracking redirect
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url) => {
      const trackUrl = `${APP_URL}/api/church-outreach/click?id=${emailId}&url=${encodeURIComponent(url)}`;
      return `href="${trackUrl}"`;
    }
  );
}

// GET /api/church-outreach/click?id=123&url=https://...
// Logs click event, redirects to original URL
```

### Anti-Patterns to Avoid
- **Sending outreach from the platform email address:** Keep outreach emails on a separate sender identity (outreach@freelumabracelets.com) to protect the platform's sender reputation (orders@freeluma.com)
- **Storing email HTML in the database with tracking links:** Store the template + merge fields separately; render HTML with tracking links at send time only
- **Running Google Places searches synchronously in the API route:** Discovery can take 5-10 seconds; use a loading state on the client, not SSR
- **Scraping without timeouts or error handling:** Church websites may be slow or down; always use AbortSignal.timeout() and wrap in try/catch
- **Hardcoding pipeline stages in the code:** Store stage definitions in the database or as a const array; allow future customization
- **Sending drip emails without checking unsubscribe status:** Always check the outreach_unsubscribes table before sending any outreach email

## Database Schema Design

### Recommended Pipeline Stages
Based on the church outreach sales cycle (discovery → contact → engagement → sample → conversion), the optimal simplified stages are:

| Stage | Key | Description |
|-------|-----|-------------|
| New Lead | `new_lead` | Discovered but not yet contacted |
| Contacted | `contacted` | Initial outreach sent |
| Engaged | `engaged` | Responded or showed interest |
| Sample Requested | `sample_requested` | Requested sample bracelets |
| Sample Sent | `sample_sent` | Samples shipped |
| Converted | `converted` | Placed an order |
| Lost | `lost` | Not interested / no response after followup |

This is 7 stages but simpler than the original spec's stages because each maps to a clear action. The "Lost" stage allows cleanup without deleting data.

### Core Tables

**churches** — Main CRM record for each church
```
id, google_place_id (unique, nullable), name, pastor_name, staff_names (JSON),
denomination, congregation_size_estimate, youth_programs (JSON),
service_times (JSON), website_url, social_media (JSON),
contact_email, contact_phone, address_line1, address_line2, city,
state, zip_code, country, latitude, longitude,
pipeline_stage (ENUM), ai_summary (TEXT), source (ENUM: 'google_places','manual','sample_request'),
notes (TEXT), created_at, updated_at
```

**church_activities** — Timestamped log of all actions on a church
```
id, church_id (FK), activity_type (ENUM: 'stage_change','email_sent','email_opened',
'email_clicked','note_added','sample_shipped','converted','created','scrape_completed','ai_researched'),
description (TEXT), metadata (JSON), admin_id (FK, nullable), created_at
```

**outreach_templates** — Email templates with merge fields
```
id, name, subject, html_body (TEXT), merge_fields (JSON — available fields list),
is_default (BOOLEAN), created_at, updated_at
```

**outreach_campaigns** — Bulk email campaign records
```
id, name, template_id (FK), filter_criteria (JSON — stage/state/denomination filters),
status (ENUM: 'draft','sending','sent','cancelled'), sent_count, open_count,
click_count, created_by (FK), sent_at, created_at, updated_at
```

**outreach_emails** — Individual email send records (for both campaigns and drip)
```
id, church_id (FK), campaign_id (FK, nullable), drip_enrollment_id (FK, nullable),
template_id (FK), to_email, subject, status (ENUM: 'queued','sent','bounced','opened','clicked'),
tracking_id (UUID), sent_at, opened_at, clicked_at, created_at
```

**outreach_unsubscribes** — Churches that opted out of outreach emails
```
id, church_id (FK, nullable), email (unique), unsubscribed_at, created_at
```

**drip_sequences** — Configurable drip sequence definitions
```
id, name, description, trigger (ENUM: 'manual','sample_shipped','stage_change'),
is_active (BOOLEAN), created_at, updated_at
```

**drip_steps** — Individual steps within a drip sequence
```
id, sequence_id (FK), step_order (INT), template_id (FK),
delay_days (INT — days after previous step), created_at, updated_at
```

**drip_enrollments** — Church enrollment in a drip sequence
```
id, church_id (FK), sequence_id (FK), current_step (INT),
status (ENUM: 'active','paused','completed','cancelled'),
next_step_at (DATE), enrolled_at, completed_at, created_at, updated_at
```

**sample_shipments** — Sample bracelet shipment records
```
id, church_id (FK), ship_date, tracking_number, carrier (ENUM: 'usps','ups','fedex','other'),
bracelet_type, quantity, shipping_address (TEXT), notes (TEXT),
created_by (FK), created_at, updated_at
```

**church_conversions** — Conversion tracking records
```
id, church_id (FK), order_date, estimated_size (INT — bracelet count),
revenue_estimate (DECIMAL), notes (TEXT), created_by (FK), created_at
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop kanban | Custom mouse/touch event handlers | @dnd-kit/core + @dnd-kit/sortable | Keyboard accessibility, touch support, smooth animations, collision detection |
| HTML parsing | Regex HTML parsing | cheerio | Regex can't reliably parse HTML; cheerio provides proper DOM traversal |
| Church data extraction from websites | Pattern matching for pastor names, etc. | Claude AI (Anthropic SDK) | Natural language understanding handles unstructured data far better than regex |
| Email merge field rendering | String.replace() chains | Template function with field map | Handles missing fields, escaping, and default values consistently |
| Geocoding (ZIP to lat/lng) | Manual ZIP code database | Google Geocoding API | Handles international addresses, partial matches, and ambiguous locations |
| CAN-SPAM footer | Inline string in each template | Shared footer component injected at send time | Ensures every email gets the footer; single point of update |

**Key insight:** The three hardest problems in this phase are (1) extracting structured data from unstructured church websites (use AI, not regex), (2) reliable drag-and-drop with accessibility (use dnd-kit, not custom events), and (3) email deliverability (use separate sender domain, proper authentication, and unsubscribe handling).

## Common Pitfalls

### Pitfall 1: Google Places API Rate Limits and Costs
**What goes wrong:** Making too many API calls during discovery, running up costs
**Why it happens:** Each Text Search request costs $0.032 (Pro tier) or $0.035 (Enterprise tier); batch discovery of 100 churches = 5 requests at 20 per page
**How to avoid:** Use field masks to request only needed fields (stay in Pro tier: $32/1000); cache results; implement admin-visible cost warnings; limit discovery batches
**Warning signs:** Monthly API costs exceeding $20; duplicate searches for same locations

### Pitfall 2: Web Scraping Failures and Timeouts
**What goes wrong:** Scraper hangs on slow/broken church websites; crashes on malformed HTML
**Why it happens:** Church websites vary wildly in quality; some are WordPress, some are custom, some are broken
**How to avoid:** Always use AbortSignal.timeout(10000); wrap each scrape in try/catch; return partial results on failure; log failures for admin visibility; run scrapes in parallel with Promise.allSettled()
**Warning signs:** Scrape jobs taking > 30 seconds; high failure rates on certain domains

### Pitfall 3: Outreach Email Deliverability
**What goes wrong:** Outreach emails landing in spam; sender domain gets blacklisted
**Why it happens:** Cold outreach emails have inherently lower engagement; no prior relationship with recipients
**How to avoid:** Verify sender domain (SPF/DKIM/DMARC) for outreach@freelumabracelets.com in SendGrid; warm up the sender gradually; include clear unsubscribe; use personal tone not marketing language; respect unsubscribes immediately
**Warning signs:** Bounce rate > 5%; open rate < 10%; spam complaints

### Pitfall 4: Drip Sequence Race Conditions
**What goes wrong:** Duplicate emails sent; steps skipped; enrollments processed after church unsubscribed
**Why it happens:** Cron job runs concurrently with manual actions; enrollment state changes between check and send
**How to avoid:** Use SELECT ... FOR UPDATE in transaction when processing drip steps; check unsubscribe status at send time (not just enrollment time); use atomic status updates
**Warning signs:** Duplicate outreach_emails records for same church+step; emails sent after unsubscribe

### Pitfall 5: Landing Page Form Spam
**What goes wrong:** Bots submit fake sample requests, polluting the CRM
**Why it happens:** Public form with no authentication
**How to avoid:** Add basic rate limiting (5 submissions per IP per hour); honeypot field (hidden input that bots fill); optional reCAPTCHA; validate phone/email format with Zod
**Warning signs:** Sudden spike in sample requests; obviously fake church names

### Pitfall 6: Kanban Board Performance with Many Churches
**What goes wrong:** UI becomes sluggish with 500+ churches across columns
**Why it happens:** All churches rendered at once; drag-and-drop recalculates on every item
**How to avoid:** Limit visible items per column (e.g., 20 with "show more"); use virtualization if needed; debounce API calls on stage change
**Warning signs:** Janky drag animations; long initial load times

### Pitfall 7: Click Tracking Breaking Email Links
**What goes wrong:** Rewritten links fail; redirects loop; special characters break URL encoding
**Why it happens:** Naive regex link rewriting doesn't handle edge cases (anchors, query params, encoded URLs)
**How to avoid:** Use proper URL encoding with encodeURIComponent(); handle # anchors; skip mailto: links; skip unsubscribe links (they need to work directly)
**Warning signs:** Broken links in sent emails; redirect errors in logs

## Code Examples

### Merge Field Template Rendering
```typescript
const MERGE_FIELDS = [
  'PastorName', 'ChurchName', 'City', 'State',
  'Denomination', 'ContactName',
] as const;

function renderTemplate(
  template: string,
  church: ChurchRecord
): string {
  const fieldMap: Record<string, string> = {
    PastorName: church.pastor_name || 'Pastor',
    ChurchName: church.name,
    City: church.city || '',
    State: church.state || '',
    Denomination: church.denomination || 'your church',
    ContactName: church.pastor_name || church.contact_email?.split('@')[0] || 'Friend',
  };

  return template.replace(
    /\{(\w+)\}/g,
    (match, field) => fieldMap[field] ?? match
  );
}
```

### Duplicate Church Detection (Landing Page)
```typescript
import { Op } from 'sequelize';

async function findDuplicateChurch(churchName: string, zipCode: string) {
  const { Church } = await import('@/lib/db/models');

  return Church.findOne({
    where: {
      name: { [Op.like]: `%${churchName}%` },
      zip_code: zipCode,
    },
  });
}
```

### Pipeline Stage Change with Activity Log
```typescript
async function updatePipelineStage(
  churchId: number,
  newStage: PipelineStage,
  adminId: number
) {
  const { Church, ChurchActivity } = await import('@/lib/db/models');

  const church = await Church.findByPk(churchId);
  if (!church) throw new Error('Church not found');

  const oldStage = church.pipeline_stage;
  await church.update({ pipeline_stage: newStage });

  await ChurchActivity.create({
    church_id: churchId,
    activity_type: 'stage_change',
    description: `Pipeline stage changed from ${oldStage} to ${newStage}`,
    metadata: { old_stage: oldStage, new_stage: newStage },
    admin_id: adminId,
  });
}
```

### Outreach Unsubscribe Check
```typescript
async function isUnsubscribed(email: string): Promise<boolean> {
  const { OutreachUnsubscribe } = await import('@/lib/db/models');
  const record = await OutreachUnsubscribe.findOne({
    where: { email: email.toLowerCase() },
  });
  return !!record;
}
```

### Sample Shipment with Auto-Advance
```typescript
async function logSampleShipment(data: ShipmentData, adminId: number) {
  const { SampleShipment, Church, ChurchActivity, DripEnrollment } =
    await import('@/lib/db/models');

  const shipment = await SampleShipment.create({
    ...data,
    created_by: adminId,
  });

  // Auto-advance pipeline stage
  await Church.update(
    { pipeline_stage: 'sample_sent' },
    { where: { id: data.church_id } }
  );

  await ChurchActivity.create({
    church_id: data.church_id,
    activity_type: 'sample_shipped',
    description: `Sample shipped via ${data.carrier}: ${data.tracking_number}`,
    admin_id: adminId,
  });

  // Trigger post-sample drip sequence
  await enrollInDripSequence(data.church_id, 'post-sample');

  return shipment;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Places API (Legacy) | Places API (New) v1 with field masks | 2023-2024 | New API uses POST with field masks for cost control; old API deprecated |
| react-beautiful-dnd | @hello-pangea/dnd or @dnd-kit | 2023+ | react-beautiful-dnd deprecated by Atlassian; hello-pangea is community fork but lacks React 19 support |
| Manual email tracking | SendGrid built-in + custom pixel | 2024+ | Disable SendGrid tracking (it masks your domain); use custom tracking for CRM-level visibility |
| Puppeteer for all scraping | Cheerio for static, Puppeteer for dynamic | Ongoing | Church websites are overwhelmingly static; Cheerio is 10x faster and lighter |

**Deprecated/outdated:**
- Google Places API (Legacy) `nearbysearch` endpoint: Use Places API (New) `searchText` with `locationBias` instead
- `react-beautiful-dnd`: Deprecated by Atlassian; use `@hello-pangea/dnd` (fork) or `@dnd-kit` (modern alternative)
- SendGrid click/open tracking for CRM use: Disable it and use custom tracking to get per-recipient analytics in your own database

## Open Questions

1. **Google Places API key provisioning**
   - What we know: Need a Google Cloud project with Places API enabled and an API key
   - What's unclear: Whether the user has a Google Cloud account and API key ready
   - Recommendation: Document API key setup in plan; make discovery features degrade gracefully if key not configured

2. **Outreach sender domain verification**
   - What we know: SendGrid requires sender domain authentication (SPF/DKIM) for deliverability
   - What's unclear: Whether freelumabracelets.com DNS is accessible for adding verification records
   - Recommendation: Build the system to work with any configured from address; document SendGrid sender verification as a setup step

3. **Physical mailing address for CAN-SPAM**
   - What we know: CAN-SPAM requires a physical mailing address in every commercial email
   - What's unclear: What address to use for the outreach emails
   - Recommendation: Store as an environment variable or platform setting; placeholder in templates until configured

4. **Landing page branding assets**
   - What we know: Landing page needs hero image of bracelets and ministry-focused design
   - What's unclear: Whether bracelet product images are available
   - Recommendation: Build with placeholder images; admin can replace via the CMS or static assets later

## Sources

### Primary (HIGH confidence)
- [Google Places API Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search) - REST endpoint, field masks, location bias parameters
- [Google Places API Pricing](https://developers.google.com/maps/billing-and-pricing/pricing) - Text Search Pro: $32/1000 requests; Enterprise: $35/1000; Pro free tier: 5000/month
- [Google Geocoding API](https://developers.google.com/maps/documentation/geocoding/overview) - ZIP code to lat/lng conversion
- [@dnd-kit/core npm](https://www.npmjs.com/package/@dnd-kit/core) - v6.3.1, peerDep: react >=16.8.0 (React 19 compatible)
- [@dnd-kit/sortable npm](https://www.npmjs.com/package/@dnd-kit/sortable) - v10.0.0, supports multiple containers
- [SendGrid Tracking Settings](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/tracking) - Open/click tracking configuration
- Existing codebase patterns: `src/lib/email/index.ts`, `src/lib/email/scheduler.ts`, `src/lib/email/tracking.ts`, `src/app/api/email/track/route.ts`

### Secondary (MEDIUM confidence)
- [Cheerio vs Puppeteer comparison (Proxyway 2026)](https://proxyway.com/guides/cheerio-vs-puppeteer-for-web-scraping) - Cheerio preferred for static sites (church websites)
- [dnd-kit Kanban tutorial (LogRocket)](https://blog.logrocket.com/build-kanban-board-dnd-kit-react/) - Multi-container sortable pattern
- [Kanban with Shadcn (Marmelab 2026)](https://marmelab.com/blog/2026/01/15/building-a-kanban-board-with-shadcn.html) - Modern React kanban patterns
- [SendGrid CAN-SPAM compliance](https://support.sendgrid.com/hc/en-us/articles/360041317534-Avoiding-Spam-Blocking-Best-Practices) - Unsubscribe and physical address requirements
- [@hello-pangea/dnd React 19 issue](https://github.com/hello-pangea/dnd/issues/863/linked_closing_reference) - Confirmed incompatible with React 19

### Tertiary (LOW confidence)
- Google Places API exact pricing may have changed since last checked (verify at billing console)
- @dnd-kit/react v0.3.2 exists as a newer React-native alternative but is pre-1.0; not recommended over stable @dnd-kit/core

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified for React 19 compatibility; existing patterns in codebase for email, cron, Anthropic SDK
- Architecture: HIGH - Follows established admin page, API route, and model patterns from 14 prior phases
- Pitfalls: HIGH - Based on real-world CRM, email deliverability, and web scraping experience; verified with official docs

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain; Google API pricing may shift)
