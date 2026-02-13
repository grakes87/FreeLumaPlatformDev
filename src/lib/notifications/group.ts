import { Op, literal, fn, col } from 'sequelize';
import {
  NotificationType,
  NotificationEntityType,
  type NotificationPayload,
  type NotificationActor,
} from './types';

export type NotificationFilter = 'all' | 'follows' | 'reactions' | 'comments' | 'prayer';

export interface GetGroupedNotificationsOptions {
  cursor?: string;
  limit?: number;
  filter?: NotificationFilter;
  unreadOnly?: boolean;
}

export interface GroupedNotification extends NotificationPayload {
  actor_count: number;
  recent_actors: NotificationActor[];
}

export interface GroupedNotificationsResult {
  notifications: GroupedNotification[];
  nextCursor: string | null;
  unreadCount: number;
}

/** Map filter name to notification type(s) */
function getFilterTypes(filter: NotificationFilter): string[] | null {
  switch (filter) {
    case 'follows':
      return [NotificationType.FOLLOW, NotificationType.FOLLOW_REQUEST];
    case 'reactions':
      return [NotificationType.REACTION];
    case 'comments':
      return [NotificationType.COMMENT];
    case 'prayer':
      return [NotificationType.PRAYER];
    case 'all':
    default:
      return null;
  }
}

/** Encode cursor from created_at + id */
function encodeCursor(createdAt: Date, id: number): string {
  return Buffer.from(`${createdAt.toISOString()}:${id}`).toString('base64');
}

/** Decode cursor to { createdAt, id } */
function decodeCursor(cursor: string): { createdAt: string; id: number } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [isoDate, idStr] = decoded.split(':');
    const id = parseInt(idStr, 10);
    if (!isoDate || isNaN(id)) return null;
    return { createdAt: isoDate, id };
  } catch {
    return null;
  }
}

/**
 * Get grouped notifications for a user.
 *
 * Strategy:
 * 1. Get the latest notification per group_key (or per id if no group_key)
 * 2. For grouped notifications, get actor_count and recent actor names
 * 3. Apply filter and cursor-based pagination
 */
export async function getGroupedNotifications(
  userId: number,
  options: GetGroupedNotificationsOptions = {}
): Promise<GroupedNotificationsResult> {
  const { cursor, limit = 20, filter = 'all', unreadOnly = false } = options;

  const { Notification, User } = await import('@/lib/db/models');
  const { sequelize } = await import('@/lib/db');

  // Build WHERE conditions
  const where: Record<string, unknown> = {
    recipient_id: userId,
  };

  if (unreadOnly) {
    where.is_read = false;
  }

  const filterTypes = getFilterTypes(filter);
  if (filterTypes) {
    where.type = { [Op.in]: filterTypes };
  }

  // Get unread count (always, regardless of filter)
  const unreadCount = await Notification.count({
    where: { recipient_id: userId, is_read: false },
  });

  // Strategy: Use a subquery to get the latest notification per group_key.
  // For notifications without group_key (NULL), each is its own group.
  // We use raw SQL for the grouped query since Sequelize ORM is awkward for this pattern.

  // Build cursor condition
  let cursorCondition = '';
  const replacements: Record<string, unknown> = { userId };

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      cursorCondition = `AND (n.created_at < :cursorDate OR (n.created_at = :cursorDate AND n.id < :cursorId))`;
      replacements.cursorDate = decoded.createdAt;
      replacements.cursorId = decoded.id;
    }
  }

  // Build filter condition
  let filterCondition = '';
  if (filterTypes) {
    filterCondition = `AND n.type IN (:filterTypes)`;
    replacements.filterTypes = filterTypes;
  }

  // Build unread condition
  let unreadCondition = '';
  if (unreadOnly) {
    unreadCondition = `AND n.is_read = false`;
  }

  // Query: Get the latest notification per group_key (or per id for ungrouped)
  // For grouped: MAX(id) as the representative notification
  // For ungrouped (group_key IS NULL): each notification is its own entry
  const query = `
    SELECT
      n.id,
      n.recipient_id,
      n.actor_id,
      n.type,
      n.entity_type,
      n.entity_id,
      n.preview_text,
      n.group_key,
      n.is_read,
      n.created_at,
      n.updated_at,
      COALESCE(g.actor_count, 1) AS actor_count
    FROM notifications n
    LEFT JOIN (
      SELECT
        group_key,
        recipient_id,
        MAX(id) AS max_id,
        COUNT(DISTINCT actor_id) AS actor_count
      FROM notifications
      WHERE recipient_id = :userId
        AND group_key IS NOT NULL
      GROUP BY group_key, recipient_id
    ) g ON n.group_key = g.group_key AND n.id = g.max_id AND n.group_key IS NOT NULL
    WHERE n.recipient_id = :userId
      ${filterCondition}
      ${unreadCondition}
      ${cursorCondition}
      AND (
        (n.group_key IS NOT NULL AND n.id = g.max_id)
        OR n.group_key IS NULL
      )
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT :limit
  `;

  replacements.limit = limit + 1; // Fetch one extra for cursor

  const rows = await sequelize.query(query, {
    replacements,
    type: 'SELECT' as const,
  }) as Array<{
    id: number;
    recipient_id: number;
    actor_id: number;
    type: string;
    entity_type: string;
    entity_id: number;
    preview_text: string | null;
    group_key: string | null;
    is_read: boolean | number;
    created_at: Date;
    updated_at: Date;
    actor_count: number;
  }>;

  // Determine if there's a next page
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  // Calculate next cursor from last item
  let nextCursor: string | null = null;
  if (hasMore && pageRows.length > 0) {
    const last = pageRows[pageRows.length - 1];
    nextCursor = encodeCursor(new Date(last.created_at), last.id);
  }

  // Collect all unique actor IDs + grouped notification group_keys for actor lookups
  const actorIds = new Set<number>();
  const groupKeys: string[] = [];

  for (const row of pageRows) {
    actorIds.add(row.actor_id);
    if (row.group_key && row.actor_count > 1) {
      groupKeys.push(row.group_key);
    }
  }

  // Fetch actor info for primary actors
  const actors = await User.findAll({
    where: { id: { [Op.in]: [...actorIds] } },
    attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
    raw: true,
  });

  const actorMap = new Map<number, NotificationActor>();
  for (const a of actors) {
    actorMap.set(a.id, {
      id: a.id,
      display_name: a.display_name,
      username: a.username,
      avatar_url: a.avatar_url,
      avatar_color: a.avatar_color,
    });
  }

  // For grouped notifications, fetch the 3 most recent actors per group_key
  const recentActorsMap = new Map<string, NotificationActor[]>();

  if (groupKeys.length > 0) {
    // Get up to 3 most recent distinct actors per group_key
    // Use a query that ranks actors by most recent notification per group
    const recentActorQuery = `
      SELECT ga.group_key, ga.actor_id,
             u.display_name, u.username, u.avatar_url, u.avatar_color
      FROM (
        SELECT group_key, actor_id, MAX(id) AS max_id,
               ROW_NUMBER() OVER (PARTITION BY group_key ORDER BY MAX(id) DESC) AS rn
        FROM notifications
        WHERE recipient_id = :userId
          AND group_key IN (:groupKeys)
        GROUP BY group_key, actor_id
      ) ga
      JOIN users u ON u.id = ga.actor_id
      WHERE ga.rn <= 3
      ORDER BY ga.group_key, ga.rn
    `;

    const recentActorRows = await sequelize.query(recentActorQuery, {
      replacements: { userId, groupKeys },
      type: 'SELECT' as const,
    }) as Array<{
      group_key: string;
      actor_id: number;
      display_name: string;
      username: string;
      avatar_url: string | null;
      avatar_color: string;
    }>;

    for (const row of recentActorRows) {
      if (!recentActorsMap.has(row.group_key)) {
        recentActorsMap.set(row.group_key, []);
      }
      recentActorsMap.get(row.group_key)!.push({
        id: row.actor_id,
        display_name: row.display_name,
        username: row.username,
        avatar_url: row.avatar_url,
        avatar_color: row.avatar_color,
      });
    }
  }

  // Build final notification payloads
  const notifications: GroupedNotification[] = pageRows.map((row) => ({
    id: row.id,
    recipient_id: row.recipient_id,
    actor_id: row.actor_id,
    type: row.type as NotificationType,
    entity_type: row.entity_type as NotificationEntityType,
    entity_id: row.entity_id,
    preview_text: row.preview_text,
    group_key: row.group_key,
    is_read: row.is_read === true || row.is_read === 1,
    created_at: new Date(row.created_at),
    actor: actorMap.get(row.actor_id),
    actor_count: Number(row.actor_count),
    recent_actors: row.group_key
      ? (recentActorsMap.get(row.group_key) ?? [actorMap.get(row.actor_id)!].filter(Boolean))
      : [actorMap.get(row.actor_id)!].filter(Boolean),
  }));

  return { notifications, nextCursor, unreadCount };
}
