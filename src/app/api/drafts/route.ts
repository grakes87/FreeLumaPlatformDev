import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { Draft } from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const saveDraftSchema = z.object({
  draft_type: z.enum(['post', 'prayer_request']),
  body: z.string().max(5000).nullable().optional(),
  media_keys: z.array(z.string()).nullable().optional(),
  metadata: z
    .object({
      category_id: z.number().int().positive().optional(),
      visibility: z.enum(['public', 'followers']).optional(),
      is_anonymous: z.boolean().optional(),
      prayer_privacy: z.enum(['public', 'followers', 'private']).optional(),
    })
    .nullable()
    .optional(),
});

/**
 * GET /api/drafts - List current user's drafts
 */
export const GET = withAuth(
  async (_req: NextRequest, context: AuthContext) => {
    try {
      const drafts = await Draft.findAll({
        where: { user_id: context.user.id },
        order: [['updated_at', 'DESC']],
      });

      return successResponse({ drafts });
    } catch (err) {
      return serverError(err, 'Failed to fetch drafts');
    }
  }
);

/**
 * POST /api/drafts - Upsert a draft (one per type per user)
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const json = await req.json();
      const parsed = saveDraftSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { draft_type, body, media_keys, metadata } = parsed.data;
      const userId = context.user.id;

      // Upsert: find existing draft for this user + type, or create
      const [draft, created] = await Draft.findOrCreate({
        where: { user_id: userId, draft_type },
        defaults: {
          user_id: userId,
          draft_type,
          body: body ?? null,
          media_keys: media_keys ?? null,
          metadata: metadata ?? null,
        },
      });

      if (!created) {
        // Update existing draft
        await draft.update({
          body: body ?? null,
          media_keys: media_keys ?? null,
          metadata: metadata ?? null,
        });
      }

      return successResponse({ draft }, created ? 201 : 200);
    } catch (err) {
      return serverError(err, 'Failed to save draft');
    }
  }
);
