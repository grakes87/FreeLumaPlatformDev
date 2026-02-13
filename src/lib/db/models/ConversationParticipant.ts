import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface ConversationParticipantAttributes {
  id: number;
  conversation_id: number;
  user_id: number;
  role: 'member' | 'admin';
  last_read_at: Date | null;
  deleted_at: Date | null;
  joined_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationParticipantCreationAttributes extends Optional<ConversationParticipantAttributes,
  | 'id'
  | 'role'
  | 'last_read_at'
  | 'deleted_at'
  | 'joined_at'
  | 'created_at'
  | 'updated_at'
> {}

class ConversationParticipant extends Model<ConversationParticipantAttributes, ConversationParticipantCreationAttributes> implements ConversationParticipantAttributes {
  declare id: number;
  declare conversation_id: number;
  declare user_id: number;
  declare role: 'member' | 'admin';
  declare last_read_at: Date | null;
  declare deleted_at: Date | null;
  declare joined_at: Date;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

ConversationParticipant.init(
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
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    role: {
      type: DataTypes.ENUM('member', 'admin'),
      allowNull: false,
      defaultValue: 'member',
    },
    last_read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'conversation_participants',
    timestamps: true,
    underscored: true,
  }
);

export { ConversationParticipant };
