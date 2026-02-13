export enum NotificationType {
  FOLLOW = 'follow',
  FOLLOW_REQUEST = 'follow_request',
  REACTION = 'reaction',
  COMMENT = 'comment',
  PRAYER = 'prayer',
  MESSAGE = 'message',
  MENTION = 'mention',
  GROUP_INVITE = 'group_invite',
  DAILY_REMINDER = 'daily_reminder',
}

export enum NotificationEntityType {
  POST = 'post',
  COMMENT = 'comment',
  FOLLOW = 'follow',
  PRAYER_REQUEST = 'prayer_request',
  MESSAGE = 'message',
  CONVERSATION = 'conversation',
  DAILY_CONTENT = 'daily_content',
}

export interface NotificationActor {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string;
}

export interface NotificationPayload {
  id: number;
  recipient_id: number;
  actor_id: number;
  type: NotificationType;
  entity_type: NotificationEntityType;
  entity_id: number;
  preview_text: string | null;
  group_key: string | null;
  is_read: boolean;
  created_at: Date;
  actor?: NotificationActor;
}

/** Notification type values as a tuple for Sequelize ENUM validation */
export const NOTIFICATION_TYPES = Object.values(NotificationType) as [string, ...string[]];

/** Notification entity type values as a tuple for Sequelize ENUM validation */
export const NOTIFICATION_ENTITY_TYPES = Object.values(NotificationEntityType) as [string, ...string[]];
