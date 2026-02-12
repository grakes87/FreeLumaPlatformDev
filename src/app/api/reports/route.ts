import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  Report,
  Post,
  PostComment,
} from '@/lib/db/models';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

const REPORT_REASONS = ['spam', 'harassment', 'hate_speech', 'inappropriate', 'self_harm', 'other'] as const;

const createReportSchema = z.object({
  post_id: z.number().int().positive().optional(),
  comment_id: z.number().int().positive().optional(),
  content_type: z.enum(['post', 'comment']),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional(),
}).refine(
  (data) => {
    if (data.content_type === 'post') return data.post_id != null;
    if (data.content_type === 'comment') return data.comment_id != null;
    return false;
  },
  { message: 'post_id is required for post reports, comment_id for comment reports' }
);

/**
 * POST /api/reports — Create a report
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    try {
      const json = await req.json();
      const parsed = createReportSchema.safeParse(json);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
      }

      const { post_id, comment_id, content_type, reason, details } = parsed.data;
      const userId = context.user.id;

      // Validate referenced content exists
      if (content_type === 'post' && post_id) {
        const post = await Post.findByPk(post_id);
        if (!post) {
          return errorResponse('Post not found', 404);
        }
      }

      if (content_type === 'comment' && comment_id) {
        const comment = await PostComment.findByPk(comment_id);
        if (!comment) {
          return errorResponse('Comment not found', 404);
        }
      }

      // Check for duplicate report
      const duplicateWhere: Record<string, unknown> = {
        reporter_id: userId,
        content_type,
      };
      if (content_type === 'post') duplicateWhere.post_id = post_id;
      if (content_type === 'comment') duplicateWhere.comment_id = comment_id;

      const existing = await Report.findOne({ where: duplicateWhere });
      if (existing) {
        return errorResponse('Already reported', 409);
      }

      // Create report
      const report = await Report.create({
        reporter_id: userId,
        post_id: content_type === 'post' ? post_id! : null,
        comment_id: content_type === 'comment' ? comment_id! : null,
        content_type,
        reason,
        details: details || null,
      });

      return successResponse({ success: true, report_id: report.id }, 201);
    } catch (error) {
      return serverError(error, 'Failed to create report');
    }
  }
);
