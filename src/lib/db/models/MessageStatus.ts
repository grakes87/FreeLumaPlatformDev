import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface MessageStatusAttributes {
  id: number;
  message_id: number;
  user_id: number;
  status: 'delivered' | 'read';
  status_at: Date;
}

export interface MessageStatusCreationAttributes extends Optional<MessageStatusAttributes,
  | 'id'
  | 'status'
  | 'status_at'
> {}

class MessageStatus extends Model<MessageStatusAttributes, MessageStatusCreationAttributes> implements MessageStatusAttributes {
  declare id: number;
  declare message_id: number;
  declare user_id: number;
  declare status: 'delivered' | 'read';
  declare status_at: Date;
}

MessageStatus.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    message_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'messages',
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
    status: {
      type: DataTypes.ENUM('delivered', 'read'),
      allowNull: false,
      defaultValue: 'delivered',
    },
    status_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'message_status',
    timestamps: false,
    underscored: true,
  }
);

export { MessageStatus };
