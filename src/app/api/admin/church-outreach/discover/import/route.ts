import { NextRequest } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { renderTemplate, renderSubject } from '@/lib/church-outreach/template-renderer';
import { generatePersonalizedEmail } from '@/lib/church-outreach/ai-email-writer';
import { seedDefaultTemplates } from '@/lib/church-outreach/default-templates';

const importChurchSchema = z.object({
  placeId: z.string().max(255).nullish(),
  name: z.string().min(1).max(255),
  address: z.string().max(500).nullish(),
  phone: z.string().max(50).nullish(),
  website: z.string().max(500).nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
}).passthrough();

const importBatchSchema = z.object({
  churches: z.array(importChurchSchema).min(1).max(100),
});

/**
 * POST /api/admin/church-outreach/discover/import - Import discovered churches into CRM
 *
 * Creates Church records from discovery results with duplicate detection by google_place_id.
 * Optionally includes AI research data.
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Church, ChurchActivity, OutreachTemplate, OutreachEmail } = await import('@/lib/db/models');
    const json = await req.json();

    const parsed = importBatchSchema.safeParse(json);
    if (!parsed.success) {
      console.error('[import] Zod errors:', JSON.stringify(parsed.error.issues, null, 2));
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { churches: churchData } = parsed.data;
    const adminId = context.user.id;

    let imported = 0;
    let skipped = 0;
    let emailsQueued = 0;
    const createdChurches: unknown[] = [];

    // Load default template for email generation (seed if none exist)
    await seedDefaultTemplates();
    const defaultTemplate = await OutreachTemplate.findOne({
      where: { is_default: true },
      order: [['id', 'ASC']],
    });

    for (const rawData of churchData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = rawData as any;
      // Check for duplicate by google_place_id
      if (data.placeId) {
        const existing = await Church.findOne({
          where: { google_place_id: data.placeId },
        });
        if (existing) {
          skipped++;
          continue;
        }
      }

      // Parse address into components
      const addressParts = parseAddress(data.address || '');

      // Create church record
      const staffNames = Array.isArray(data.staff_members)
        ? data.staff_members.filter((s: any) => s?.name).map((s: any) => `${s.name}${s.role ? ` (${s.role})` : ''}`)
        : null;

      const church = await Church.create({
        google_place_id: data.placeId || null,
        name: data.name,
        website_url: data.website || null,
        contact_phone: data.contact_phone || data.phone || null,
        contact_email: data.contact_email || null,
        address_line1: addressParts.line1,
        city: addressParts.city,
        state: addressParts.state,
        zip_code: addressParts.zip,
        latitude: data.lat || null,
        longitude: data.lng || null,
        source: 'google_places',
        pipeline_stage: 'new_lead',
        // Research data
        pastor_name: data.pastor_name || null,
        staff_names: staffNames,
        denomination: data.denomination || null,
        congregation_size_estimate: data.congregation_size_estimate || null,
        youth_programs: data.youth_programs || null,
        service_times: data.service_times || null,
        social_media: data.social_media || null,
        ai_summary: data.summary || null,
        outreach_fit_score: data.outreach_fit_score ?? null,
        outreach_fit_reason: data.outreach_fit_reason || null,
        has_youth_ministry: data.has_youth_ministry || false,
        has_young_adult_ministry: data.has_young_adult_ministry || false,
        has_small_groups: data.has_small_groups || false,
        has_missions_focus: data.has_missions_focus || false,
      });

      // Create activity: created
      await ChurchActivity.create({
        church_id: church.id,
        activity_type: 'created',
        description: 'Imported from Google Places discovery',
        admin_id: adminId,
      });

      // Create activity: scrape_completed (if website was scraped)
      if (data.wasScraped) {
        await ChurchActivity.create({
          church_id: church.id,
          activity_type: 'scrape_completed',
          description: `Website scraped: ${data.website || 'N/A'}`,
          admin_id: adminId,
        });
      }

      // Create activity: ai_researched (if AI research was done)
      if (data.wasResearched) {
        await ChurchActivity.create({
          church_id: church.id,
          activity_type: 'ai_researched',
          description: 'AI research completed during discovery',
          admin_id: adminId,
        });
      }

      // Generate AI email draft if church has contact_email and template exists
      if (church.contact_email && defaultTemplate) {
        try {
          const churchData2 = {
            name: church.name,
            pastor_name: church.pastor_name,
            city: church.city,
            state: church.state,
            denomination: church.denomination,
            contact_email: church.contact_email,
          };

          const renderedHtml = renderTemplate(
            defaultTemplate.html_body,
            churchData2,
            defaultTemplate.template_assets,
          );
          const renderedSubjectStr = renderSubject(defaultTemplate.subject, churchData2);

          // AI personalization (falls back to template if AI unavailable)
          let aiResult = { subject: renderedSubjectStr, html: renderedHtml };
          try {
            aiResult = await generatePersonalizedEmail(
              {
                name: church.name,
                pastor_name: church.pastor_name,
                denomination: church.denomination,
                congregation_size_estimate: church.congregation_size_estimate,
                city: church.city,
                state: church.state,
                youth_programs: church.youth_programs,
                ai_summary: church.ai_summary,
                outreach_fit_score: church.outreach_fit_score,
                outreach_fit_reason: church.outreach_fit_reason,
                has_youth_ministry: church.has_youth_ministry,
                has_young_adult_ministry: church.has_young_adult_ministry,
                has_small_groups: church.has_small_groups,
                has_missions_focus: church.has_missions_focus,
              },
              renderedSubjectStr,
              renderedHtml,
              { stepOrder: 1, totalSteps: 1, sequenceName: 'Import Outreach' },
              defaultTemplate.template_assets,
            );
          } catch (aiErr) {
            console.warn(`[import] AI email generation failed for church ${church.id}, using template fallback`);
          }

          const trackingId = uuidv4();
          await OutreachEmail.create({
            church_id: church.id,
            template_id: defaultTemplate.id,
            to_email: church.contact_email,
            subject: aiResult.subject,
            status: 'pending_review',
            tracking_id: trackingId,
            rendered_html: renderedHtml,
            ai_html: aiResult.html,
            ai_subject: aiResult.subject,
          });

          emailsQueued++;
        } catch (emailErr) {
          console.error(`[import] Email generation failed for church ${church.id}:`, emailErr);
          // Don't fail the import — church is already created
        }
      }

      createdChurches.push(church.toJSON());
      imported++;
    }

    return successResponse({
      imported,
      skipped,
      emailsQueued,
      churches: createdChurches,
    }, 201);
  } catch (error) {
    return serverError(error, 'Failed to import churches');
  }
});

/**
 * Parse a Google Places formatted address into components.
 * Format: "123 Main St, City, ST 12345, USA"
 */
function parseAddress(address: string): {
  line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
} {
  if (!address) {
    return { line1: null, city: null, state: null, zip: null };
  }

  const parts = address.split(',').map((p) => p.trim());

  if (parts.length >= 3) {
    const line1 = parts[0] || null;
    const city = parts[1] || null;
    // "ST 12345" or "ST"
    const stateZip = parts[2] || '';
    const stateZipMatch = stateZip.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
    const state = stateZipMatch ? stateZipMatch[1] : stateZip || null;
    const zip = stateZipMatch ? (stateZipMatch[2] || null) : null;

    return { line1, city, state, zip };
  }

  // Fallback: just use the whole address as line1
  return { line1: address, city: null, state: null, zip: null };
}
