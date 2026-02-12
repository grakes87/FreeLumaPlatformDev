import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface RepostAttributes {
  id: number;
  user_id: number;
  post_id: number;
  quote_post_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface RepostCreationAttributes extends Optional<RepostAttributes,
  | 'id'
  | 'created_at'
  | 'updated_at'
> {}

class Repost extends Model<RepostAttributes, RepostCreationAttributes> implements RepostAttributes {
  declare id: number;
  declare user_id: number;
  declare post_id: number;
  declare quote_post_id: number;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Repost.init(
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
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'posts',
        key: 'id',
      },
    },
    quote_post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'posts',
        key: 'id',
      },
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'reposts',
    timestamps: true,
    underscored: true,
  }
);

export { Repost };
