import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { PlatformSetting } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/platform-settings - Read all settings as key-value object
 * Any authenticated user can read (needed for client-side feed_style, etc.)
 */
export const GET = withAuth(
  async (_req: NextRequest, _context: AuthContext) => {
    try {
      const settings = await PlatformSetting.findAll();

      // Convert to key-value object
      const result: Record<string, string> = {};
      for (const s of settings) {
        result[s.key] = s.value;
      }

      return successResponse(result);
    } catch (err) {
      return serverError(err, 'Failed to fetch platform settings');
    }
  }
);

const updateSettingSchema = z.object({
  key: z.string().min(1, 'Key is required').max(100),
  value: z.string().min(1, 'Value is required'),
});

/**
 * PUT /api/platform-settings - Update a setting (admin only)
 */
export const PUT = withAdmin(
  async (req: NextRequest, _context: AuthContext) => {
    try {
      const json = await req.json();
      const parsed = updateSettingSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { key, value } = parsed.data;

      // Upsert: create if not exists, update if exists
      await PlatformSetting.set(key, value);

      return successResponse({ key, value });
    } catch (err) {
      return serverError(err, 'Failed to update platform setting');
    }
  }
);
