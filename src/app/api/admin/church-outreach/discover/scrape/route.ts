import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const scrapeSchema = z.object({
  websiteUrl: z.string().url().max(500),
  placeId: z.string().max(255).optional(),
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(500),
});

/**
 * POST /api/admin/church-outreach/discover/scrape - Scrape a church website and run AI research
 *
 * Returns combined result with scraped data and AI research profile.
 * Returns partial results on scrape or research failure (never throws).
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const json = await req.json();

    const parsed = scrapeSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { websiteUrl, placeId, name, address } = parsed.data;

    const { scrapeChurchWebsite } = await import('@/lib/church-outreach/scraper');
    const { researchChurch } = await import('@/lib/church-outreach/ai-researcher');

    // Step 1: Scrape the website
    const scraped = await scrapeChurchWebsite(websiteUrl);

    if (!scraped) {
      return successResponse({
        scraped: null,
        research: null,
        message: 'Could not scrape website. It may be unavailable or blocking automated requests.',
      });
    }

    // Step 2: Run AI research on scraped data
    let research = null;
    try {
      // Build a minimal PlacesResult for the researcher
      const placesData = {
        placeId: placeId || '',
        name,
        address,
        phone: scraped.phones[0] || null,
        website: websiteUrl,
        types: [] as string[],
        lat: 0,
        lng: 0,
        googleMapsUrl: '',
        rating: null,
        ratingCount: null,
      };

      research = await researchChurch(scraped, placesData);
    } catch {
      // AI research failed — return scraped data only
    }

    return successResponse({ scraped, research });
  } catch (error) {
    return serverError(error, 'Failed to scrape church website');
  }
});
