import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { notifyCreatorRejection } from '@/lib/content-pipeline/notifications';

const reviewSchema = z.object({
  daily_content_id: z.number().int().positive(),
  action: z.enum(['approve', 'reject', 'revert']),
  rejection_note: z.string().min(1).max(2000).optional(),
});

/**
 * POST /api/admin/content-production/review
 *
 * Approve, reject, or revert content status with transition validation.
 *
 * Body:
 *   daily_content_id: number
 *   action: 'approve' | 'reject' | 'revert'
 *   rejection_note?: string (required when action is 'reject')
 *
 * Valid status transitions:
 *   approve: submitted -> approved
 *   reject:  submitted -> rejected
 *   revert:  approved  -> submitted  (admin un-approves to swap content)
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { DailyContent } = await import('@/lib/db/models');

    const json = await req.json();
    const parsed = reviewSchema.safeParse(json);

    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || 'Invalid input',
        400
      );
    }

    const { daily_content_id, action, rejection_note } = parsed.data;

    // Validate rejection_note is provided for reject action
    if (action === 'reject' && !rejection_note) {
      return errorResponse('rejection_note is required when rejecting content', 400);
    }

    // Find the content record
    const content = await DailyContent.findByPk(daily_content_id);
    if (!content) {
      return errorResponse('Daily content not found', 404);
    }

    // Validate status transitions
    switch (action) {
      case 'approve': {
        if (content.status !== 'submitted') {
          return errorResponse(
            `Cannot approve content with status "${content.status}". Only "submitted" content can be approved.`,
            400
          );
        }

        await content.update({ status: 'approved', rejection_note: null });
        break;
      }

      case 'reject': {
        if (content.status !== 'submitted') {
          return errorResponse(
            `Cannot reject content with status "${content.status}". Only "submitted" content can be rejected.`,
            400
          );
        }

        await content.update({
          status: 'rejected',
          rejection_note: rejection_note!,
        });

        // Fire-and-forget: notify creator of rejection
        notifyCreatorRejection(daily_content_id);
        break;
      }

      case 'revert': {
        if (content.status !== 'approved') {
          return errorResponse(
            `Cannot revert content with status "${content.status}". Only "approved" content can be reverted.`,
            400
          );
        }

        await content.update({ status: 'submitted', rejection_note: null });
        break;
      }

      default:
        return errorResponse('Unknown action', 400);
    }

    // Reload to return fresh data
    await content.reload();

    return successResponse({ content: content.toJSON() });
  } catch (error) {
    return serverError(error, 'Failed to process review');
  }
});
