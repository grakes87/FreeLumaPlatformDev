import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { createHeygenVideo, HeygenError } from '@/lib/heygen';

const triggerSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format'),
  mode: z.enum(['bible', 'positivity']),
});

interface PendingVideoMap {
  [videoId: string]: {
    dailyContentId: number;
    creatorId: number;
    creatorName: string;
    triggeredAt: string;
  };
}

/**
 * POST /api/admin/content-production/heygen
 * Trigger bulk HeyGen video generation for AI creators in a given month.
 *
 * Body: { month: "YYYY-MM", mode: "bible" | "positivity" }
 *
 * For each active AI creator, finds their assigned DailyContent for the month
 * that does not yet have a creator_video_url, and triggers HeyGen generation.
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContent, LumaShortCreator, PlatformSetting } = await import('@/lib/db/models');

    const json = await req.json();
    const parsed = triggerSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { month, mode } = parsed.data;

    // 1. Get HeyGen API key
    const apiKey = await PlatformSetting.get('heygen_api_key');
    if (!apiKey) {
      return errorResponse('HeyGen API key not configured. Set "heygen_api_key" in platform settings.', 503);
    }

    // 2. Build callback URL from platform base URL
    const baseUrl = await PlatformSetting.get('platform_base_url');
    const callbackUrl = baseUrl ? `${baseUrl}/api/webhooks/heygen` : undefined;

    // 3. Find active AI creators
    const aiCreators = await LumaShortCreator.findAll({
      where: {
        is_ai: true,
        active: true,
        heygen_avatar_id: { [Op.ne]: null },
        ...(mode === 'bible' ? { can_bible: true } : { can_positivity: true }),
      },
    });

    if (aiCreators.length === 0) {
      return errorResponse('No active AI creators found with HeyGen avatar IDs', 404);
    }

    // 4. Calculate date range for the month
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${month}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    // 5. Load existing pending videos map
    const existingPendingJson = await PlatformSetting.get('heygen_pending_videos');
    const pendingMap: PendingVideoMap = existingPendingJson
      ? JSON.parse(existingPendingJson)
      : {};

    // Track already-pending content IDs to avoid double-triggering
    const alreadyPendingContentIds = new Set(
      Object.values(pendingMap).map((v) => v.dailyContentId),
    );

    let triggered = 0;
    const errors: Array<{ creatorId: number; contentId: number; error: string }> = [];

    for (const creator of aiCreators) {
      // Find assigned content without video for this creator + month
      const contentItems = await DailyContent.findAll({
        where: {
          creator_id: creator.id,
          mode,
          post_date: { [Op.between]: [startDate, endDate] },
          creator_video_url: null,
          status: { [Op.in]: ['assigned', 'generated'] },
        },
        order: [['post_date', 'ASC']],
      });

      for (const content of contentItems) {
        // Skip if already pending
        if (alreadyPendingContentIds.has(content.id)) {
          continue;
        }

        // Use camera_script or content_text as the script
        const scriptText = content.camera_script || content.content_text;
        if (!scriptText) {
          continue;
        }

        try {
          // Rate limiting: 1 second delay between API calls
          if (triggered > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          const videoId = await createHeygenVideo({
            avatarId: creator.heygen_avatar_id!,
            scriptText,
            apiKey,
            callbackUrl,
          });

          // Track pending video
          pendingMap[videoId] = {
            dailyContentId: content.id,
            creatorId: creator.id,
            creatorName: creator.name,
            triggeredAt: new Date().toISOString(),
          };
          alreadyPendingContentIds.add(content.id);
          triggered++;
        } catch (err) {
          const message = err instanceof HeygenError
            ? `[${err.statusCode}] ${err.apiError}`
            : String(err);
          errors.push({
            creatorId: creator.id,
            contentId: content.id,
            error: message,
          });
          console.error(`[HeyGen] Failed to trigger video for content ${content.id}:`, err);
        }
      }
    }

    // 6. Save updated pending map
    await PlatformSetting.set('heygen_pending_videos', JSON.stringify(pendingMap));

    return successResponse({
      triggered,
      ai_creators: aiCreators.length,
      month,
      mode,
      pending_total: Object.keys(pendingMap).length,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    return serverError(error, 'Failed to trigger HeyGen generation');
  }
});

/**
 * GET /api/admin/content-production/heygen
 * Check status of all pending HeyGen videos.
 */
export const GET = withAdmin(async (_req: NextRequest, _context: AuthContext) => {
  try {
    const { PlatformSetting } = await import('@/lib/db/models');

    const pendingJson = await PlatformSetting.get('heygen_pending_videos');
    const pendingMap: PendingVideoMap = pendingJson ? JSON.parse(pendingJson) : {};

    const pendingCount = Object.keys(pendingMap).length;
    const videos = Object.entries(pendingMap).map(([videoId, info]) => ({
      video_id: videoId,
      ...info,
    }));

    return successResponse({
      pending_count: pendingCount,
      videos,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch HeyGen status');
  }
});
