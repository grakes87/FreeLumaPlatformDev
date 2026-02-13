import {
  NotificationType,
  NotificationEntityType,
  type NotificationPayload,
  type NotificationActor,
} from './types';

export interface CreateNotificationParams {
  recipient_id: number;
  actor_id: number;
  type: NotificationType;
  entity_type: NotificationEntityType;
  entity_id: number;
  preview_text?: string | null;
  group_key?: string | null;
}

/**
 * Auto-generate a group_key based on notification type.
 * Grouped types: reaction, comment, prayer.
 * Ungrouped types: follow, follow_request, message, mention, group_invite, daily_reminder.
 */
function generateGroupKey(
  type: NotificationType,
  entityType: NotificationEntityType,
  entityId: number
): string | null {
  switch (type) {
    case NotificationType.REACTION:
      return `reaction:${entityType}:${entityId}`;
    case NotificationType.COMMENT:
      return `comment:${entityType}:${entityId}`;
    case NotificationType.PRAYER:
      return `prayer:prayer_request:${entityId}`;
    default:
      return null;
  }
}

/**
 * Centralized notification creation function.
 * Writes to DB and pushes via Socket.IO in a single call.
 *
 * Suppresses:
 * - Self-notifications (actor === recipient)
 * - Notifications from blocked users (bidirectional)
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<NotificationPayload | null> {
  const { recipient_id, actor_id, type, entity_type, entity_id, preview_text } = params;

  // Suppress self-notifications
  if (recipient_id === actor_id) {
    return null;
  }

  // Check block status: skip if actor is blocked by recipient (bidirectional)
  const { getBlockedUserIds } = await import('@/lib/utils/blocks');
  const blockedIds = await getBlockedUserIds(recipient_id);
  if (blockedIds.has(actor_id)) {
    return null;
  }

  // Auto-generate group_key if not provided
  const group_key = params.group_key !== undefined
    ? params.group_key
    : generateGroupKey(type, entity_type, entity_id);

  // Create notification in DB
  const { Notification, User } = await import('@/lib/db/models');

  const notification = await Notification.create({
    recipient_id,
    actor_id,
    type,
    entity_type,
    entity_id,
    preview_text: preview_text ?? null,
    group_key,
  });

  // Fetch actor info for the real-time payload
  const actor = await User.findByPk(actor_id, {
    attributes: ['id', 'display_name', 'username', 'avatar_url', 'avatar_color'],
    raw: true,
  });

  const payload: NotificationPayload = {
    id: notification.id,
    recipient_id: notification.recipient_id,
    actor_id: notification.actor_id,
    type: notification.type as NotificationType,
    entity_type: notification.entity_type as NotificationEntityType,
    entity_id: notification.entity_id,
    preview_text: notification.preview_text,
    group_key: notification.group_key,
    is_read: notification.is_read,
    created_at: notification.created_at,
    actor: actor
      ? {
          id: actor.id,
          display_name: actor.display_name,
          username: actor.username,
          avatar_url: actor.avatar_url,
          avatar_color: actor.avatar_color,
        } as NotificationActor
      : undefined,
  };

  // Push via Socket.IO (non-fatal if not initialized, e.g. in tests)
  try {
    const { getIO } = await import('@/lib/socket/index');
    getIO()
      .of('/notifications')
      .to(`user:${recipient_id}`)
      .emit('notification:new', payload);
  } catch {
    // Socket.IO may not be initialized in test environments or during build
  }

  return payload;
}
