import { Op } from 'sequelize';
import type { DailyContentStatus } from '@/lib/db/models/DailyContent';
import { notifyCreatorAssignment } from '@/lib/content-pipeline/notifications';

/**
 * Auto-assign daily content for a given month to eligible creators
 * using round-robin distribution, respecting monthly capacity limits.
 *
 * @param month - Format YYYY-MM (e.g. "2026-03")
 * @param mode  - Content mode: 'bible' or 'positivity'
 * @returns { assigned: number; skipped: number }
 */
export async function autoAssignMonth(
  month: string,
  mode: 'bible' | 'positivity'
): Promise<{ assigned: number; skipped: number }> {
  const { LumaShortCreator, DailyContent } = await import('@/lib/db/models');

  // Parse month string
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new Error(`Invalid month format: ${month}. Expected YYYY-MM.`);
  }

  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  // Query eligible creators by mode flag
  const modeFilter = mode === 'bible' ? { can_bible: true } : { can_positivity: true };

  const creators = await LumaShortCreator.findAll({
    where: { active: true, ...modeFilter },
    order: [['id', 'ASC']],
  });

  if (creators.length === 0) {
    return { assigned: 0, skipped: 0 };
  }

  // Count existing assignments this month per creator
  const existingAssignments = await DailyContent.findAll({
    where: {
      post_date: { [Op.between]: [startDate, endDate] },
      mode,
      creator_id: { [Op.ne]: null },
    },
    attributes: ['creator_id'],
  });

  const assignmentCounts = new Map<number, number>();
  for (const row of existingAssignments) {
    const cid = row.creator_id!;
    assignmentCounts.set(cid, (assignmentCounts.get(cid) || 0) + 1);
  }

  // Query unassigned generated content for this month + mode
  const unassigned = await DailyContent.findAll({
    where: {
      post_date: { [Op.between]: [startDate, endDate] },
      mode,
      creator_id: null,
      status: 'generated',
    },
    order: [['post_date', 'ASC']],
  });

  if (unassigned.length === 0) {
    return { assigned: 0, skipped: 0 };
  }

  // Round-robin assignment
  let assigned = 0;
  let creatorIndex = 0;
  const newAssignmentCounts = new Map<number, number>();

  for (const day of unassigned) {
    // Find next creator with available capacity
    let found = false;
    let checked = 0;

    while (checked < creators.length) {
      const creator = creators[creatorIndex % creators.length];
      const currentCount = assignmentCounts.get(creator.id) || 0;

      if (currentCount < creator.monthly_capacity) {
        // Assign this day to this creator
        await day.update({ creator_id: creator.id, status: 'assigned' });
        assignmentCounts.set(creator.id, currentCount + 1);
        newAssignmentCounts.set(creator.id, (newAssignmentCounts.get(creator.id) || 0) + 1);
        assigned++;
        found = true;
        creatorIndex = (creatorIndex + 1) % creators.length;
        break;
      }

      creatorIndex = (creatorIndex + 1) % creators.length;
      checked++;
    }

    if (!found) {
      // All creators at capacity
      break;
    }
  }

  // Fire-and-forget: notify each creator who received new assignments
  for (const [creatorId, count] of newAssignmentCounts) {
    notifyCreatorAssignment(creatorId, month, mode, count);
  }

  return { assigned, skipped: unassigned.length - assigned };
}

/**
 * Reassign a specific daily content item to a different creator.
 *
 * @param dailyContentId - The DailyContent record ID
 * @param newCreatorId   - The LumaShortCreator ID to assign to
 */
export async function reassignDay(
  dailyContentId: number,
  newCreatorId: number
): Promise<void> {
  const { LumaShortCreator, DailyContent } = await import('@/lib/db/models');

  const content = await DailyContent.findByPk(dailyContentId);
  if (!content) {
    throw new Error(`DailyContent not found: ${dailyContentId}`);
  }

  if (content.status === 'approved') {
    throw new Error('Cannot reassign approved content');
  }

  const creator = await LumaShortCreator.findByPk(newCreatorId);
  if (!creator || !creator.active) {
    throw new Error(`Active creator not found: ${newCreatorId}`);
  }

  // Verify mode compatibility
  if (content.mode === 'bible' && !creator.can_bible) {
    throw new Error('Creator cannot handle bible content');
  }
  if (content.mode === 'positivity' && !creator.can_positivity) {
    throw new Error('Creator cannot handle positivity content');
  }

  // Update creator assignment
  const updates: { creator_id: number; status?: DailyContentStatus } = { creator_id: newCreatorId };

  // Only upgrade status from 'generated' to 'assigned'
  if (content.status === 'generated') {
    updates.status = 'assigned';
  }
  // For 'assigned', 'submitted', 'rejected' -- keep current status, just change creator

  await content.update(updates);
}
