import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface DailyCommentAttributes {
  id: number;
  user_id: number;
  daily_content_id: number;
  parent_id: number | null;
  body: string;
  edited: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DailyCommentCreationAttributes extends Optional<DailyCommentAttributes,
  | 'id'
  | 'parent_id'
  | 'edited'
  | 'created_at'
  | 'updated_at'
> {}

class DailyComment extends Model<DailyCommentAttributes, DailyCommentCreationAttributes> implements DailyCommentAttributes {
  declare id: number;
  declare user_id: number;
  declare daily_content_id: number;
  declare parent_id: number | null;
  declare body: string;
  declare edited: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

DailyComment.init(
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
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'daily_comments',
        key: 'id',
      },
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    edited: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'daily_comments',
    timestamps: true,
    underscored: true,
  }
);

export { DailyComment };
