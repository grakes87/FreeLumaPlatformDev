import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index';

export interface PostCommentAttributes {
  id: number;
  user_id: number;
  post_id: number;
  parent_id: number | null;
  body: string;
  edited: boolean;
  flagged: boolean;
  hidden: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PostCommentCreationAttributes extends Optional<PostCommentAttributes,
  | 'id'
  | 'parent_id'
  | 'edited'
  | 'flagged'
  | 'hidden'
  | 'created_at'
  | 'updated_at'
> {}

class PostComment extends Model<PostCommentAttributes, PostCommentCreationAttributes> implements PostCommentAttributes {
  declare id: number;
  declare user_id: number;
  declare post_id: number;
  declare parent_id: number | null;
  declare body: string;
  declare edited: boolean;
  declare flagged: boolean;
  declare hidden: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

PostComment.init(
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
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'post_comments',
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
    flagged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    hidden: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'post_comments',
    timestamps: true,
    underscored: true,
  }
);

export { PostComment };
