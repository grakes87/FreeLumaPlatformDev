import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface ListenLogAttributes {
  id: number;
  user_id: number;
  daily_content_id: number;
  listen_seconds: number;
  completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ListenLogCreationAttributes extends Optional<ListenLogAttributes,
  | 'id'
  | 'listen_seconds'
  | 'completed'
  | 'created_at'
  | 'updated_at'
> {}

class ListenLog extends Model<ListenLogAttributes, ListenLogCreationAttributes> implements ListenLogAttributes {
  declare id: number;
  declare user_id: number;
  declare daily_content_id: number;
  declare listen_seconds: number;
  declare completed: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

ListenLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    daily_content_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'daily_content',
        key: 'id',
      },
    },
    listen_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'listen_logs',
    timestamps: true,
    underscored: true,
  }
);

export { ListenLog };
