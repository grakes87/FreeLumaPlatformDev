import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/church-outreach/auto-discovery - Read auto-discovery config
 */
export const GET = withAdmin(async (_req: NextRequest, _context: AuthContext) => {
  try {
    const { getAutoDiscoveryConfig } = await import('@/lib/church-outreach/auto-discovery-scheduler');
    const { PlatformSetting } = await import('@/lib/db/models');

    const config = await getAutoDiscoveryConfig();
    const freelumaContext = await PlatformSetting.get('outreach_freeluma_context') || '';

    return successResponse({ config, freelumaContext });
  } catch (error) {
    return serverError(error, 'Failed to fetch auto-discovery config');
  }
});

const configSchema = z.object({
  enabled: z.boolean().optional(),
  target_locations: z.array(z.string().min(1).max(200)).optional(),
  radius_miles: z.number().min(1).max(50).optional(),
  min_fit_score: z.number().min(1).max(10).optional(),
  max_per_run: z.number().min(1).max(100).optional(),
  auto_enroll_sequence_id: z.number().nullable().optional(),
  run_at_hour_utc: z.number().min(0).max(23).optional(),
  freelumaContext: z.string().max(5000).optional(),
});

/**
 * PUT /api/admin/church-outreach/auto-discovery - Update config
 */
export const PUT = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const json = await req.json();
    const parsed = configSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { freelumaContext, ...configFields } = parsed.data;

    const { setAutoDiscoveryConfig, getAutoDiscoveryConfig } = await import('@/lib/church-outreach/auto-discovery-scheduler');
    const { PlatformSetting } = await import('@/lib/db/models');

    if (Object.keys(configFields).length > 0) {
      await setAutoDiscoveryConfig(configFields);
    }

    if (freelumaContext !== undefined) {
      await PlatformSetting.set('outreach_freeluma_context', freelumaContext);
    }

    const config = await getAutoDiscoveryConfig();
    return successResponse({ config });
  } catch (error) {
    return serverError(error, 'Failed to update auto-discovery config');
  }
});

/**
 * POST /api/admin/church-outreach/auto-discovery - Trigger manual run
 */
export const POST = withAdmin(async (_req: NextRequest, _context: AuthContext) => {
  try {
    const { runAutoDiscovery } = await import('@/lib/church-outreach/auto-discovery-scheduler');
    const stats = await runAutoDiscovery();
    return successResponse({ stats });
  } catch (error) {
    return serverError(error, 'Failed to run auto-discovery');
  }
});
