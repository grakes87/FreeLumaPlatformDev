import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface NotificationAttributes {
  id: number;
  recipient_id: number;
  actor_id: number;
  type: 'follow' | 'follow_request' | 'reaction' | 'comment' | 'prayer' | 'message' | 'mention' | 'group_invite' | 'daily_reminder';
  entity_type: 'post' | 'comment' | 'follow' | 'prayer_request' | 'message' | 'conversation' | 'daily_content';
  entity_id: number;
  preview_text: string | null;
  group_key: string | null;
  is_read: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationCreationAttributes extends Optional<NotificationAttributes,
  | 'id'
  | 'preview_text'
  | 'group_key'
  | 'is_read'
  | 'created_at'
  | 'updated_at'
> {}

class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  declare id: number;
  declare recipient_id: number;
  declare actor_id: number;
  declare type: 'follow' | 'follow_request' | 'reaction' | 'comment' | 'prayer' | 'message' | 'mention' | 'group_invite' | 'daily_reminder';
  declare entity_type: 'post' | 'comment' | 'follow' | 'prayer_request' | 'message' | 'conversation' | 'daily_content';
  declare entity_id: number;
  declare preview_text: string | null;
  declare group_key: string | null;
  declare is_read: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    recipient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    actor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM('follow', 'follow_request', 'reaction', 'comment', 'prayer', 'message', 'mention', 'group_invite', 'daily_reminder'),
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.ENUM('post', 'comment', 'follow', 'prayer_request', 'message', 'conversation', 'daily_content'),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    preview_text: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    group_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
  }
);

export { Notification };
