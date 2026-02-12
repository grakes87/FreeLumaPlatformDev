import { Op } from 'sequelize';

/**
 * Get the set of user IDs that are blocked in either direction
 * (users the given user blocked, and users who blocked the given user).
 *
 * This is used to filter out content from blocked users in feeds,
 * search results, and post detail views.
 */
export async function getBlockedUserIds(userId: number): Promise<Set<number>> {
  // Lazy import to avoid circular dependency at module load
  const { Block } = await import('@/lib/db/models');

  const blocks = await Block.findAll({
    where: {
      [Op.or]: [
        { blocker_id: userId },
        { blocked_id: userId },
      ],
    },
    attributes: ['blocker_id', 'blocked_id'],
    raw: true,
  });

  const blockedIds = new Set<number>();
  for (const block of blocks) {
    if (block.blocker_id !== userId) blockedIds.add(block.blocker_id);
    if (block.blocked_id !== userId) blockedIds.add(block.blocked_id);
  }

  return blockedIds;
}
