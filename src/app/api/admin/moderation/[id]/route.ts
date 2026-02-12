import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const actionSchema = z.object({
  action: z.enum(['approve', 'remove', 'dismiss']),
  admin_notes: z.string().max(2000).optional(),
  item_type: z.enum(['report', 'flagged_post', 'flagged_comment']),
});

/**
 * PUT /api/admin/moderation/[id] - Take action on a report or flagged item
 */
export const PUT = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const { Report, Post, PostComment } = await import('@/lib/db/models');
    const params = await context.params;
    const id = parseInt(params.id, 10);
    const json = await req.json();

    const parsed = actionSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { action, admin_notes, item_type } = parsed.data;
    const adminId = context.user.id;

    if (item_type === 'report') {
      if (isNaN(id)) {
        return errorResponse('Invalid report ID', 400);
      }

      const report = await Report.findByPk(id);
      if (!report) {
        return errorResponse('Report not found', 404);
      }

      if (action === 'approve') {
        // Mark as reviewed, no content change
        report.status = 'reviewed';
      } else if (action === 'remove') {
        // Mark as actioned and soft-delete/delete the content
        report.status = 'actioned';

        if (report.content_type === 'post' && report.post_id) {
          const post = await Post.findByPk(report.post_id);
          if (post) {
            await post.destroy(); // paranoid soft-delete
          }
        } else if (report.content_type === 'comment' && report.comment_id) {
          const comment = await PostComment.findByPk(report.comment_id);
          if (comment) {
            await comment.destroy(); // hard delete
          }
        }
      } else if (action === 'dismiss') {
        report.status = 'dismissed';
      }

      if (admin_notes) {
        report.admin_notes = admin_notes;
      }
      report.reviewed_by = adminId;
      report.reviewed_at = new Date();
      await report.save();

      return successResponse({ success: true, action, status: report.status });
    }

    if (item_type === 'flagged_post') {
      if (isNaN(id)) {
        return errorResponse('Invalid post ID', 400);
      }

      const post = await Post.findByPk(id, { paranoid: false });
      if (!post) {
        return errorResponse('Post not found', 404);
      }

      if (action === 'approve') {
        post.flagged = false;
        await post.save();
      } else if (action === 'remove') {
        await post.destroy(); // paranoid soft-delete
      } else if (action === 'dismiss') {
        // Just clear the flag for dismiss as well
        post.flagged = false;
        await post.save();
      }

      return successResponse({ success: true, action });
    }

    if (item_type === 'flagged_comment') {
      if (isNaN(id)) {
        return errorResponse('Invalid comment ID', 400);
      }

      const comment = await PostComment.findByPk(id);
      if (!comment) {
        return errorResponse('Comment not found', 404);
      }

      if (action === 'approve') {
        comment.flagged = false;
        await comment.save();
      } else if (action === 'remove') {
        await comment.destroy(); // hard delete
      } else if (action === 'dismiss') {
        comment.flagged = false;
        await comment.save();
      }

      return successResponse({ success: true, action });
    }

    return errorResponse('Invalid item type', 400);
  } catch (error) {
    return serverError(error, 'Failed to process moderation action');
  }
});
