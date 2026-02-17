import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface VerseCategoryCommentAttributes {
  id: number;
  user_id: number;
  verse_category_content_id: number;
  parent_id: number | null;
  body: string;
  edited: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface VerseCategoryCommentCreationAttributes extends Optional<VerseCategoryCommentAttributes,
  | 'id'
  | 'parent_id'
  | 'edited'
  | 'created_at'
  | 'updated_at'
> {}

class VerseCategoryComment extends Model<VerseCategoryCommentAttributes, VerseCategoryCommentCreationAttributes> implements VerseCategoryCommentAttributes {
  declare id: number;
  declare user_id: number;
  declare verse_category_content_id: number;
  declare parent_id: number | null;
  declare body: string;
  declare edited: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

VerseCategoryComment.init(
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
    verse_category_content_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'verse_category_content',
        key: 'id',
      },
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'verse_category_comments',
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
    tableName: 'verse_category_comments',
    timestamps: true,
    underscored: true,
  }
);

export { VerseCategoryComment };
