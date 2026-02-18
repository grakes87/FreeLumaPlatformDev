import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { createHeygenVideo, HeygenError } from '@/lib/heygen';

/**
 * Pick a random value from a comma-separated string.
 * e.g. "avatar_1,avatar_2,avatar_3" → "avatar_2"
 */
function pickRandom(csv: string): string {
  const items = csv.split(',').map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return csv;
  return items[Math.floor(Math.random() * items.length)];
}

const triggerSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format'),
  mode: z.enum(['bible', 'positivity']),
  /** Optional: trigger for a single daily_content row instead of the whole month */
  daily_content_id: z.number().int().positive().optional(),
});

interface PendingVideoEntry {
  dailyContentId: number;
  creatorId: number;
  creatorName: string;
  logId: number;
  triggeredAt: string;
}

interface PendingVideoMap {
  [videoId: string]: PendingVideoEntry;
}

/**
 * POST /api/admin/content-production/heygen
 * Trigger HeyGen video generation for AI creators.
 *
 * Body:
 *   month: "YYYY-MM"
 *   mode: "bible" | "positivity"
 *   daily_content_id?: number  (single-day mode)
 *
 * In single-day mode, generates a video for a specific daily_content row.
 * In bulk mode, generates for all eligible AI-creator-assigned rows in the month.
 *
 * Creates ContentGenerationLog entries for each triggered video so that
 * the Generation Queue UI can track progress.
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContent, LumaShortCreator, PlatformSetting, ContentGenerationLog } =
      await import('@/lib/db/models');

    const json = await req.json();
    const parsed = triggerSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { month, mode, daily_content_id } = parsed.data;

    // 1. Get HeyGen API key
    const apiKey = await PlatformSetting.get('heygen_api_key');
    if (!apiKey) {
      return errorResponse('HeyGen API key not configured. Set "heygen_api_key" in platform settings.', 503);
    }

    // 2. Build callback URL from platform base URL
    const baseUrl = await PlatformSetting.get('platform_base_url');
    const callbackUrl = baseUrl ? `${baseUrl}/api/webhooks/heygen` : undefined;

    // 3. Load existing pending videos map
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

    // -------------------------------------------------------------------
    // Single-day mode
    // -------------------------------------------------------------------
    if (daily_content_id) {
      const content = await DailyContent.findByPk(daily_content_id, {
        include: [
          {
            model: LumaShortCreator,
            as: 'creator',
            attributes: ['id', 'name', 'is_ai', 'heygen_avatar_id', 'heygen_voice_id'],
          },
        ],
      });

      if (!content) {
        return errorResponse('Daily content not found', 404);
      }

      const creator = (content as unknown as { creator?: { id: number; name: string; is_ai: boolean; heygen_avatar_id: string | null; heygen_voice_id: string | null } }).creator;

      if (!creator || !creator.is_ai || !creator.heygen_avatar_id) {
        return errorResponse('Content is not assigned to an AI creator with a HeyGen avatar', 400);
      }

      if (alreadyPendingContentIds.has(content.id)) {
        return errorResponse('Video generation is already pending for this content', 409);
      }

      const scriptText = content.camera_script || content.content_text;
      if (!scriptText) {
        return errorResponse('No script text available (camera_script or content_text required)', 400);
      }

      // Create generation log
      const logEntry = await ContentGenerationLog.create({
        daily_content_id: content.id,
        field: 'heygen_video',
        status: 'started',
      });
      const logStartTime = Date.now();

      // Pick random avatar/voice from comma-separated lists
      const avatarId = pickRandom(creator.heygen_avatar_id);
      const voiceId = creator.heygen_voice_id ? pickRandom(creator.heygen_voice_id) : undefined;

      try {
        const videoId = await createHeygenVideo({
          avatarId,
          scriptText,
          apiKey,
          callbackUrl,
          voiceId,
        });

        // Track pending video (include logId for webhook to update)
        pendingMap[videoId] = {
          dailyContentId: content.id,
          creatorId: creator.id,
          creatorName: creator.name,
          logId: logEntry.id,
          triggeredAt: new Date().toISOString(),
        };

        await PlatformSetting.set('heygen_pending_videos', JSON.stringify(pendingMap));
        triggered = 1;
      } catch (err) {
        const message = err instanceof HeygenError
          ? `[${err.statusCode}] ${err.apiError}`
          : String(err);
        await logEntry.update({
          status: 'failed',
          error_message: message,
          duration_ms: Date.now() - logStartTime,
        });
        errors.push({
          creatorId: creator.id,
          contentId: content.id,
          error: message,
        });
      }

      return successResponse({
        triggered,
        ai_creators: 1,
        month,
        mode,
        pending_total: Object.keys(pendingMap).length,
        log_id: logEntry.id,
        ...(errors.length > 0 ? { errors } : {}),
      });
    }

    // -------------------------------------------------------------------
    // Bulk mode (original behavior + logging)
    // -------------------------------------------------------------------

    // Find active AI creators
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

    // Calculate date range for the month
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${month}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    for (const creator of aiCreators) {
      // Find assigned content without video for this creator + month
      const contentItems = await DailyContent.findAll({
        where: {
          creator_id: creator.id,
          mode,
          post_date: { [Op.between]: [startDate, endDate] },
          lumashort_video_url: null,
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

        // Create generation log entry
        const logEntry = await ContentGenerationLog.create({
          daily_content_id: content.id,
          field: 'heygen_video',
          status: 'started',
        });
        const logStartTime = Date.now();

        try {
          // Rate limiting: 1 second delay between API calls
          if (triggered > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          // Pick random avatar/voice from comma-separated lists
          const avatarId = pickRandom(creator.heygen_avatar_id!);
          const voiceId = creator.heygen_voice_id ? pickRandom(creator.heygen_voice_id) : undefined;

          const videoId = await createHeygenVideo({
            avatarId,
            scriptText,
            apiKey,
            callbackUrl,
            voiceId,
          });

          // Track pending video
          pendingMap[videoId] = {
            dailyContentId: content.id,
            creatorId: creator.id,
            creatorName: creator.name,
            logId: logEntry.id,
            triggeredAt: new Date().toISOString(),
          };
          alreadyPendingContentIds.add(content.id);
          triggered++;
        } catch (err) {
          const message = err instanceof HeygenError
            ? `[${err.statusCode}] ${err.apiError}`
            : String(err);
          await logEntry.update({
            status: 'failed',
            error_message: message,
            duration_ms: Date.now() - logStartTime,
          });
          errors.push({
            creatorId: creator.id,
            contentId: content.id,
            error: message,
          });
          console.error(`[HeyGen] Failed to trigger video for content ${content.id}:`, err);
        }
      }
    }

    // Save updated pending map
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
    // Include actual error in response for debugging
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[HeyGen Route Error]', error);
    return errorResponse(`Failed to trigger HeyGen generation: ${msg}`, 500);
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
