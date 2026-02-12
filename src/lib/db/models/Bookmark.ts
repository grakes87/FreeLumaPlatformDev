import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface BookmarkAttributes {
  id: number;
  user_id: number;
  post_id: number | null;
  daily_content_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface BookmarkCreationAttributes extends Optional<BookmarkAttributes,
  | 'id'
  | 'post_id'
  | 'daily_content_id'
  | 'created_at'
  | 'updated_at'
> {}

class Bookmark extends Model<BookmarkAttributes, BookmarkCreationAttributes> implements BookmarkAttributes {
  declare id: number;
  declare user_id: number;
  declare post_id: number | null;
  declare daily_content_id: number | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Bookmark.init(
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
      allowNull: true,
      references: {
        model: 'posts',
        key: 'id',
      },
    },
    daily_content_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'daily_content',
        key: 'id',
      },
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'bookmarks',
    timestamps: true,
    underscored: true,
  }
);

export { Bookmark };
