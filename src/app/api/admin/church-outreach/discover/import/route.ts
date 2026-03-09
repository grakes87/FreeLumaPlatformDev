import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const importChurchSchema = z.object({
  placeId: z.string().max(255).optional(),
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).nullish(),
  website: z.string().url().max(500).nullish(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  // Optional research data
  pastor_name: z.string().max(255).nullish(),
  staff_names: z.array(z.string()).nullish(),
  denomination: z.string().max(100).nullish(),
  congregation_size_estimate: z.string().max(50).nullish(),
  youth_programs: z.array(z.string()).nullish(),
  service_times: z.array(z.string()).nullish(),
  social_media: z.record(z.string(), z.string()).nullish(),
  contact_email: z.string().email().max(255).nullish(),
  contact_phone: z.string().max(50).nullish(),
  ai_summary: z.string().nullish(),
  wasScraped: z.boolean().optional(),
  wasResearched: z.boolean().optional(),
});

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
    const { Church, ChurchActivity } = await import('@/lib/db/models');
    const json = await req.json();

    const parsed = importBatchSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { churches: churchData } = parsed.data;
    const adminId = context.user.id;

    let imported = 0;
    let skipped = 0;
    const createdChurches: unknown[] = [];

    for (const data of churchData) {
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
        // Research data (if available)
        pastor_name: data.pastor_name || null,
        staff_names: data.staff_names || null,
        denomination: data.denomination || null,
        congregation_size_estimate: data.congregation_size_estimate || null,
        youth_programs: data.youth_programs || null,
        service_times: data.service_times || null,
        social_media: data.social_media || null,
        ai_summary: data.ai_summary || null,
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

      createdChurches.push(church.toJSON());
      imported++;
    }

    return successResponse({
      imported,
      skipped,
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
