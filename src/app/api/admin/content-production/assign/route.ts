import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { autoAssignMonth, reassignDay } from '@/lib/content-pipeline/assignment';

const assignSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('auto_assign'),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format'),
    mode: z.enum(['bible', 'positivity']),
    language: z.string().min(2).max(5).optional(),
  }),
  z.object({
    action: z.literal('reassign'),
    daily_content_id: z.number().int().positive(),
    creator_id: z.number().int().positive(),
  }),
]);

/**
 * POST /api/admin/content-production/assign
 *
 * Handles content assignment operations:
 *   - auto_assign: Round-robin assigns all unassigned content for a month to eligible creators
 *   - reassign: Reassigns a specific day's content to a different creator
 *
 * Body:
 *   For auto_assign: { action: 'auto_assign', month: 'YYYY-MM', mode: 'bible' | 'positivity' }
 *   For reassign:    { action: 'reassign', daily_content_id: number, creator_id: number }
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const json = await req.json();
    const parsed = assignSchema.safeParse(json);

    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || 'Invalid input',
        400
      );
    }

    const data = parsed.data;

    if (data.action === 'auto_assign') {
      const result = await autoAssignMonth(data.month, data.mode, data.language);
      return successResponse({
        assigned: result.assigned,
        skipped: result.skipped,
      });
    }

    if (data.action === 'reassign') {
      try {
        await reassignDay(data.daily_content_id, data.creator_id);
        return successResponse({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Reassignment failed';
        // Check for known error messages to return appropriate status codes
        if (message.includes('not found')) {
          return errorResponse(message, 404);
        }
        if (message.includes('Cannot reassign') || message.includes('cannot handle')) {
          return errorResponse(message, 400);
        }
        throw error;
      }
    }

    return errorResponse('Unknown action', 400);
  } catch (error) {
    return serverError(error, 'Failed to process assignment');
  }
});
