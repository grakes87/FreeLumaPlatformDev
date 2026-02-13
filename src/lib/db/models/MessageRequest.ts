import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface MessageRequestAttributes {
  id: number;
  conversation_id: number;
  requester_id: number;
  recipient_id: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: Date;
  updated_at: Date;
}

export interface MessageRequestCreationAttributes extends Optional<MessageRequestAttributes,
  | 'id'
  | 'status'
  | 'created_at'
  | 'updated_at'
> {}

class MessageRequest extends Model<MessageRequestAttributes, MessageRequestCreationAttributes> implements MessageRequestAttributes {
  declare id: number;
  declare conversation_id: number;
  declare requester_id: number;
  declare recipient_id: number;
  declare status: 'pending' | 'accepted' | 'declined';
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

MessageRequest.init(
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
    requester_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    recipient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined'),
      allowNull: false,
      defaultValue: 'pending',
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'message_requests',
    timestamps: true,
    underscored: true,
  }
);

export { MessageRequest };
