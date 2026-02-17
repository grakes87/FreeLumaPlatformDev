import { sendCreatorAssignmentEmail } from '@/lib/email/templates/creator-assignment';
import { sendCreatorRejectionEmail } from '@/lib/email/templates/creator-rejection';

/**
 * Notify a creator that new scripts have been assigned to them.
 * Fire-and-forget: logs errors but does not throw.
 */
export async function notifyCreatorAssignment(
  creatorId: number,
  month: string,
  mode: 'bible' | 'positivity',
  assignmentCount: number
): Promise<void> {
  try {
    const { LumaShortCreator, User } = await import('@/lib/db/models');

    const creator = await LumaShortCreator.findByPk(creatorId);
    if (!creator) {
      console.warn(`[Notification] Creator not found: ${creatorId}`);
      return;
    }

    const user = await User.findByPk(creator.user_id);
    if (!user || !user.email) {
      console.warn(`[Notification] User not found or no email for creator: ${creatorId}`);
      return;
    }

    await sendCreatorAssignmentEmail({
      creatorEmail: user.email,
      creatorName: creator.name,
      assignmentCount,
      month,
      mode,
    });

    console.log(`[Notification] Assignment email sent to ${user.email} for ${month} ${mode} (${assignmentCount} scripts)`);
  } catch (error) {
    console.error('[Notification] Failed to send assignment email:', error);
  }
}

/**
 * Notify a creator that their submitted video has been rejected.
 * Fire-and-forget: logs errors but does not throw.
 */
export async function notifyCreatorRejection(
  dailyContentId: number
): Promise<void> {
  try {
    const { DailyContent, LumaShortCreator, User } = await import('@/lib/db/models');

    const content = await DailyContent.findByPk(dailyContentId);
    if (!content) {
      console.warn(`[Notification] DailyContent not found: ${dailyContentId}`);
      return;
    }

    if (!content.creator_id) {
      console.warn(`[Notification] No creator assigned to content: ${dailyContentId}`);
      return;
    }

    if (!content.rejection_note) {
      console.warn(`[Notification] No rejection note on content: ${dailyContentId}`);
      return;
    }

    const creator = await LumaShortCreator.findByPk(content.creator_id);
    if (!creator) {
      console.warn(`[Notification] Creator not found: ${content.creator_id}`);
      return;
    }

    const user = await User.findByPk(creator.user_id);
    if (!user || !user.email) {
      console.warn(`[Notification] User not found or no email for creator: ${content.creator_id}`);
      return;
    }

    await sendCreatorRejectionEmail({
      creatorEmail: user.email,
      creatorName: creator.name,
      date: content.post_date,
      rejectionNote: content.rejection_note,
      mode: content.mode,
    });

    console.log(`[Notification] Rejection email sent to ${user.email} for ${content.post_date}`);
  } catch (error) {
    console.error('[Notification] Failed to send rejection email:', error);
  }
}
