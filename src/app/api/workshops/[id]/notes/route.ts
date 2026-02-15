import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const updateNoteSchema = z.object({
  content: z
    .string()
    .max(50000, 'Notes cannot exceed 50,000 characters'),
});

/**
 * GET /api/workshops/[id]/notes - Get personal notes for a workshop
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (!workshopId || isNaN(workshopId)) {
        return errorResponse('Valid workshop ID required');
      }

      const userId = context.user.id;

      const { WorkshopNote } = await import('@/lib/db/models');

      const note = await WorkshopNote.findOne({
        where: { workshop_id: workshopId, user_id: userId },
        attributes: ['content', 'updated_at'],
      });

      return successResponse({
        note: note
          ? { content: note.content, updated_at: note.updated_at }
          : null,
      });
    } catch (error) {
      return serverError(error, 'Failed to fetch workshop notes');
    }
  }
);

/**
 * PUT /api/workshops/[id]/notes - Upsert personal notes for a workshop
 *
 * Called with debounce from the client for auto-save.
 */
export const PUT = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const params = await context.params;
      const workshopId = parseInt(params.id, 10);
      if (!workshopId || isNaN(workshopId)) {
        return errorResponse('Valid workshop ID required');
      }

      const userId = context.user.id;

      const json = await req.json();
      const parsed = updateNoteSchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(
          parsed.error.issues[0]?.message || 'Invalid input'
        );
      }

      const { content } = parsed.data;

      const { Workshop, WorkshopNote } = await import('@/lib/db/models');

      // Validate workshop exists
      const workshop = await Workshop.findByPk(workshopId, {
        attributes: ['id'],
      });
      if (!workshop) {
        return errorResponse('Workshop not found', 404);
      }

      // Upsert: findOrCreate then update
      const [note, created] = await WorkshopNote.findOrCreate({
        where: { workshop_id: workshopId, user_id: userId },
        defaults: { workshop_id: workshopId, user_id: userId, content },
      });

      if (!created) {
        await note.update({ content });
      }

      return successResponse({
        note: {
          content: note.content,
          updated_at: note.updated_at,
        },
      });
    } catch (error) {
      return serverError(error, 'Failed to save workshop notes');
    }
  }
);
