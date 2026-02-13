import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface ConversationAttributes {
  id: number;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  creator_id: number | null;
  last_message_id: number | null;
  last_message_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationCreationAttributes extends Optional<ConversationAttributes,
  | 'id'
  | 'type'
  | 'name'
  | 'avatar_url'
  | 'creator_id'
  | 'last_message_id'
  | 'last_message_at'
  | 'created_at'
  | 'updated_at'
> {}

class Conversation extends Model<ConversationAttributes, ConversationCreationAttributes> implements ConversationAttributes {
  declare id: number;
  declare type: 'direct' | 'group';
  declare name: string | null;
  declare avatar_url: string | null;
  declare creator_id: number | null;
  declare last_message_id: number | null;
  declare last_message_at: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Conversation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.ENUM('direct', 'group'),
      allowNull: false,
      defaultValue: 'direct',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    creator_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    last_message_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'conversations',
    timestamps: true,
    underscored: true,
  }
);

export { Conversation };
