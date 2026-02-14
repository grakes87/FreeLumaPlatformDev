import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface ModerationLogAttributes {
  id: number;
  admin_id: number;
  action: 'remove_content' | 'warn_user' | 'ban_user' | 'unban_user' | 'edit_user' | 'dismiss_report';
  target_user_id: number | null;
  target_content_type: 'post' | 'comment' | 'video' | null;
  target_content_id: number | null;
  reason: string | null;
  metadata: string | null;
  created_at: Date;
}

export interface ModerationLogCreationAttributes extends Optional<ModerationLogAttributes,
  | 'id'
  | 'target_user_id'
  | 'target_content_type'
  | 'target_content_id'
  | 'reason'
  | 'metadata'
  | 'created_at'
> {}

class ModerationLog extends Model<ModerationLogAttributes, ModerationLogCreationAttributes> implements ModerationLogAttributes {
  declare id: number;
  declare admin_id: number;
  declare action: 'remove_content' | 'warn_user' | 'ban_user' | 'unban_user' | 'edit_user' | 'dismiss_report';
  declare target_user_id: number | null;
  declare target_content_type: 'post' | 'comment' | 'video' | null;
  declare target_content_id: number | null;
  declare reason: string | null;
  declare metadata: string | null;
  declare readonly created_at: Date;
}

ModerationLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    action: {
      type: DataTypes.ENUM('remove_content', 'warn_user', 'ban_user', 'unban_user', 'edit_user', 'dismiss_report'),
      allowNull: false,
    },
    target_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    target_content_type: {
      type: DataTypes.ENUM('post', 'comment', 'video'),
      allowNull: true,
    },
    target_content_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'moderation_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export { ModerationLog };
