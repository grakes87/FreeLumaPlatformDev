import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface MessageAttributes {
  id: number;
  conversation_id: number;
  sender_id: number;
  type: 'text' | 'media' | 'voice' | 'shared_post' | 'system';
  content: string | null;
  reply_to_id: number | null;
  shared_post_id: number | null;
  is_unsent: boolean;
  flagged: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MessageCreationAttributes extends Optional<MessageAttributes,
  | 'id'
  | 'type'
  | 'content'
  | 'reply_to_id'
  | 'shared_post_id'
  | 'is_unsent'
  | 'flagged'
  | 'created_at'
  | 'updated_at'
> {}

class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  declare id: number;
  declare conversation_id: number;
  declare sender_id: number;
  declare type: 'text' | 'media' | 'voice' | 'shared_post' | 'system';
  declare content: string | null;
  declare reply_to_id: number | null;
  declare shared_post_id: number | null;
  declare is_unsent: boolean;
  declare flagged: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Message.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    conversation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'conversations',
        key: 'id',
      },
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM('text', 'media', 'voice', 'shared_post', 'system'),
      allowNull: false,
      defaultValue: 'text',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reply_to_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'messages',
        key: 'id',
      },
    },
    shared_post_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'posts',
        key: 'id',
      },
    },
    is_unsent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    flagged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'messages',
    timestamps: true,
    underscored: true,
  }
);

export { Message };
