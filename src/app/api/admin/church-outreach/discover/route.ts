import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const discoverSchema = z.object({
  location: z.string().min(1).max(100),
  radiusMiles: z.number().min(1).max(50),
  filters: z.string().max(200).optional(),
});

/**
 * POST /api/admin/church-outreach/discover - Search for churches via Google Places
 *
 * Returns an array of PlacesResult objects with an `already_imported` boolean
 * flag for each result that already exists in the churches table.
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const json = await req.json();

    const parsed = discoverSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { location, radiusMiles, filters } = parsed.data;

    // Check if Google Places API key is configured
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return successResponse({
        results: [],
        message: 'GOOGLE_PLACES_API_KEY is not configured. Set it in .env.local to enable church discovery.',
      });
    }

    const { searchChurches } = await import('@/lib/church-outreach/google-places');
    const { Church } = await import('@/lib/db/models');

    const results = await searchChurches({ location, radiusMiles, filters });

    // Check which results are already imported
    const placeIds = results.map((r) => r.placeId).filter(Boolean);
    let importedPlaceIds = new Set<string>();

    if (placeIds.length > 0) {
      const { Op } = await import('sequelize');
      const existing = await Church.findAll({
        where: { google_place_id: { [Op.in]: placeIds } },
        attributes: ['google_place_id'],
      });
      importedPlaceIds = new Set(
        existing.map((c) => c.google_place_id).filter((id): id is string => id !== null)
      );
    }

    const resultsWithStatus = results.map((r) => ({
      ...r,
      already_imported: importedPlaceIds.has(r.placeId),
    }));

    return successResponse({ results: resultsWithStatus });
  } catch (error) {
    return serverError(error, 'Failed to search for churches');
  }
});
