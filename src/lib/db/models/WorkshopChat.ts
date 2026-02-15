import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface WorkshopChatAttributes {
  id: number;
  workshop_id: number;
  user_id: number;
  message: string;
  offset_ms: number;
  created_at: Date;
}

export interface WorkshopChatCreationAttributes extends Optional<WorkshopChatAttributes,
  | 'id'
  | 'created_at'
> {}

class WorkshopChat extends Model<WorkshopChatAttributes, WorkshopChatCreationAttributes> implements WorkshopChatAttributes {
  declare id: number;
  declare workshop_id: number;
  declare user_id: number;
  declare message: string;
  declare offset_ms: number;
  declare readonly created_at: Date;
}

WorkshopChat.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    workshop_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'workshops',
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
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    offset_ms: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'workshop_chats',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export { WorkshopChat };
